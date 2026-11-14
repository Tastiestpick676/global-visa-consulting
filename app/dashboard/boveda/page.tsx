// app/api/notifications/email/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const OTP_SECRET =
  process.env.OTP_HMAC_SECRET ||
  process.env.RESEND_API_KEY ||
  "gvc-zero-trust-default-hmac-secret-2026";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutos estrictos

const usedOtpTokens = new Map<string, number>();
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Genera el enlace oficial de restablecimiento de contraseña de Firebase (oobCode)
 * usando únicamente el módulo nativo `crypto` de Node.js y la API REST de Google,
 * evitando el crash ERR_REQUIRE_ESM de firebase-admin / jwks-rsa / jose en Vercel.
 */
async function generateFirebasePasswordResetLinkRest(
  targetEmail: string
): Promise<string | null> {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) return null;

  try {
    // Limpia comillas envolventes si existen
    const cleanedRaw = rawKey.trim().replace(/^['"]|['"]$/g, "");
    const serviceAccount = JSON.parse(cleanedRaw);

    const clientEmail: string | undefined = serviceAccount.client_email;
    const projectId: string | undefined = serviceAccount.project_id;
    let privateKey: string | undefined = serviceAccount.private_key;

    if (!clientEmail || !privateKey || !projectId) return null;
    privateKey = privateKey.replace(/\\n/g, "\n");

    const nowSec = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" })
    ).toString("base64url");
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        sub: clientEmail,
        scope:
          "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase",
        aud: "https://oauth2.googleapis.com/token",
        iat: nowSec,
        exp: nowSec + 3600,
      })
    ).toString("base64url");

    const unsignedJwt = `${header}.${claimSet}`;
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsignedJwt);
    const signature = signer.sign(privateKey, "base64url");
    const assertion = `${unsignedJwt}.${signature}`;

    // 1. Intercambiar el JWT firmado por un Access Token OAuth2 de Google
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.access_token;
    if (!accessToken) return null;

    // 2. Solicitar el oobLink de PASSWORD_RESET sin que Firebase envíe su correo por defecto
    const oobRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email: targetEmail,
          returnOobLink: true,
        }),
      }
    );

    if (!oobRes.ok) return null;
    const oobData = await oobRes.json();
    return oobData?.oobLink || null;
  } catch {
    return null;
  }
}

function checkRateLimit(
  key: string,
  maxRequests = 10,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

async function verifyFirebaseIdToken(
  idToken: string
): Promise<{ uid: string; email: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || !idToken) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const account = data?.users?.[0];
    if (!account?.localId || !account?.email) return null;
    return {
      uid: String(account.localId),
      email: String(account.email).toLowerCase(),
    };
  } catch {
    return null;
  }
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeCtaUrl(
  rawUrl?: string,
  requestOrigin?: string
): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(
      rawUrl,
      requestOrigin || "https://globalvisaconsult.com"
    );
    const allowedHosts = [
      "localhost",
      "127.0.0.1",
      "globalvisaconsult.com",
      "www.globalvisaconsult.com",
      "calendar.google.com",
      "meet.google.com",
    ];
    const isAllowed =
      allowedHosts.includes(parsed.hostname) ||
      parsed.hostname.endsWith(".vercel.app") ||
      parsed.hostname.endsWith(".globalvisaconsult.com");

    if (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      isAllowed
    ) {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function createSignedOtpToken(uid: string, email: string, otpCode: string) {
  const expiresAt = Date.now() + OTP_TTL_MS;
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = `${uid}|${email.toLowerCase()}|${otpCode}|${expiresAt}|${nonce}`;
  const signature = crypto
    .createHmac("sha256", OTP_SECRET)
    .update(payload)
    .digest("hex");

  const token = Buffer.from(
    JSON.stringify({
      uid,
      email: email.toLowerCase(),
      expiresAt,
      nonce,
      signature,
    })
  ).toString("base64url");

  return { token, expiresAt };
}

function verifySignedOtpToken(
  token: string,
  uid: string,
  email: string,
  otpGuess: string
): { valid: boolean; reason?: string; twoFactorProof?: string } {
  try {
    const now = Date.now();
    for (const [k, exp] of usedOtpTokens.entries()) {
      if (now > exp) usedOtpTokens.delete(k);
    }

    if (!token || !otpGuess || otpGuess.length !== 6) {
      return {
        valid: false,
        reason: "Formato de código o token de desafío inválido.",
      };
    }

    // Soporte híbrido: acepta tanto el token nuevo (base64url JSON) como el formato viejo (expiresAt.nonce.signature)
    if (token.includes(".")) {
      if (usedOtpTokens.has(token)) {
        return {
          valid: false,
          reason: "Este código ya fue utilizado. Solicita uno nuevo.",
        };
      }
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { valid: false, reason: "Token de desafío inválido." };
      }
      const [expiresAtStr, nonce, signature] = parts;
      const expiresAt = Number(expiresAtStr);
      if (!expiresAt || now > expiresAt) {
        return {
          valid: false,
          reason: "El código de verificación ha expirado (máx. 5 min).",
        };
      }
      const expectedData = `${email.toLowerCase()}:${otpGuess.trim()}:${expiresAt}:${nonce}`;
      const expectedSig = crypto
        .createHmac("sha256", OTP_SECRET)
        .update(expectedData)
        .digest("hex");

      const sigBufA = Buffer.from(signature, "hex");
      const sigBufB = Buffer.from(expectedSig, "hex");
      if (
        sigBufA.length !== sigBufB.length ||
        !crypto.timingSafeEqual(sigBufA, sigBufB)
      ) {
        return {
          valid: false,
          reason: "El código de 6 dígitos es incorrecto.",
        };
      }
      usedOtpTokens.set(token, expiresAt + 60_000);
      const twoFactorProof = crypto
        .createHmac("sha256", OTP_SECRET)
        .update(`verified|${uid}|${nonce}|${now}`)
        .digest("hex");
      return { valid: true, twoFactorProof };
    }

    const decoded = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8")
    );
    if (!decoded || typeof decoded !== "object") {
      return { valid: false, reason: "Token de desafío inválido." };
    }

    const {
      uid: tokenUid,
      email: tokenEmail,
      expiresAt,
      nonce,
      signature,
    } = decoded;

    if (usedOtpTokens.has(nonce)) {
      return {
        valid: false,
        reason: "Este código ya fue utilizado. Solicita uno nuevo.",
      };
    }

    if (tokenUid !== uid || tokenEmail !== email.toLowerCase()) {
      return {
        valid: false,
        reason: "El desafío no corresponde a la sesión actual.",
      };
    }

    if (now > Number(expiresAt)) {
      return {
        valid: false,
        reason: "El código de verificación ha expirado (máx. 5 min).",
      };
    }

    const expectedPayload = `${uid}|${email.toLowerCase()}|${otpGuess.trim()}|${expiresAt}|${nonce}`;
    const expectedSig = crypto
      .createHmac("sha256", OTP_SECRET)
      .update(expectedPayload)
      .digest("hex");

    const sigBufA = Buffer.from(String(signature), "hex");
    const sigBufB = Buffer.from(expectedSig, "hex");

    if (
      sigBufA.length !== sigBufB.length ||
      !crypto.timingSafeEqual(sigBufA, sigBufB)
    ) {
      return {
        valid: false,
        reason:
          "El código de 6 dígitos es incorrecto. Verifica e intenta de nuevo.",
      };
    }

    // Marcar nonce como consumido (Anti-Replay)
    usedOtpTokens.set(nonce, Number(expiresAt) + 60_000);

    // Emitir prueba criptográfica de 64 caracteres para Firestore Rules
    const twoFactorProof = crypto
      .createHmac("sha256", OTP_SECRET)
      .update(`verified|${uid}|${nonce}|${now}`)
      .digest("hex");

    return { valid: true, twoFactorProof };
  } catch {
    return {
      valid: false,
      reason: "No se pudo validar la firma criptográfica del código.",
    };
  }
}

// ============================================================================
// PLANTILLAS HTML (DISEÑO CLÁSICO MINIMALISTA: CABECERA #111315 + CUERPO BLANCO)
// ============================================================================

function buildOtpEmailHtml(params: {
  recipientName: string;
  otpCode: string;
  sandboxBannerHtml?: string;
}): string {
  const safeName = escapeHtml(params.recipientName || "Titular");
  const safeOtp = escapeHtml(params.otpCode);

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Código de Verificación de Acceso — Global Visa Consulting</title>
      </head>
      <body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
          ${params.sandboxBannerHtml || ""}
          <div style="background:#111315;padding:24px 32px;color:#FFFFFF;">
            <span style="display:inline-block;background:#E11D48;color:#FFFFFF;font-size:10px;font-weight:800;letter-spacing:0.15em;padding:4px 12px;border-radius:999px;text-transform:uppercase;">
              GLOBAL VISA CONSULTING
            </span>
            <h1 style="margin:12px 0 0;font-size:20px;font-weight:800;color:#FFFFFF;">
              Código de Verificación de Acceso
            </h1>
          </div>
          <div style="padding:32px;color:#111315;line-height:1.6;font-size:14px;">
            <p style="margin-top:0;">Hola <strong>${safeName}</strong>,</p>
            <p>Ingresa el siguiente código de 6 dígitos para confirmar tu identidad y acceder a tu portal:</p>
            <div style="margin:24px 0;padding:20px;background:#F3F4F6;border:2px dashed #E11D48;border-radius:16px;text-align:center;">
              <span style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#6B7280;letter-spacing:0.1em;">
                Código de Verificación (Expira en 5 min)
              </span>
              <span style="display:block;font-family:monospace;font-size:32px;font-weight:800;letter-spacing:0.25em;color:#111315;margin-top:8px;">
                ${safeOtp}
              </span>
            </div>
          </div>
          <div style="background:#F9FAFB;padding:18px 32px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">
            Notificación automática protegida bajo arquitectura Zero-Trust PII • Global Visa Consulting.
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildPasswordResetEmailHtml(params: {
  email: string;
  resetUrl: string;
  sandboxBannerHtml?: string;
}): string {
  const safeEmail = escapeHtml(params.email);
  const safeUrl = escapeHtml(params.resetUrl);

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Configura o Restablece tu Contraseña — Global Visa Consulting</title>
      </head>
      <body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
          ${params.sandboxBannerHtml || ""}
          <div style="background:#111315;padding:24px 32px;color:#FFFFFF;">
            <span style="display:inline-block;background:#E11D48;color:#FFFFFF;font-size:10px;font-weight:800;letter-spacing:0.15em;padding:4px 12px;border-radius:999px;text-transform:uppercase;">
              GLOBAL VISA CONSULTING
            </span>
            <h1 style="margin:12px 0 0;font-size:20px;font-weight:800;color:#FFFFFF;">
              Configuración Segura de Contraseña
            </h1>
          </div>
          <div style="padding:32px;color:#111315;line-height:1.6;font-size:14px;">
            <p style="margin-top:0;">Hola,</p>
            <p>Recibimos una solicitud para activar o restablecer la contraseña privada asociada al expediente de <strong>${safeEmail}</strong>:</p>
            <div style="margin:24px 0;padding:24px 20px;background:#F3F4F6;border:2px dashed #E11D48;border-radius:16px;text-align:center;">
              <span style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#6B7280;letter-spacing:0.1em;margin-bottom:16px;">
                Enlace de Configuración (Un solo uso)
              </span>
              <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#E11D48;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;padding:12px 24px;border-radius:999px;">
                Crear o Restablecer mi Contraseña &rarr;
              </a>
              <span style="display:block;font-size:11px;color:#6B7280;margin-top:14px;">
                Este botón se invalidará automáticamente tras guardar tu clave.
              </span>
            </div>
            <p style="margin-bottom:0;font-size:12px;color:#6B7280;">
              Si no solicitaste este enlace, puedes ignorar este correo con tranquilidad; tus credenciales actuales siguen protegidas.
            </p>
          </div>
          <div style="background:#F9FAFB;padding:18px 32px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">
            Notificación automática protegida bajo arquitectura Zero-Trust PII • Global Visa Consulting.
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildTransactionalEmailHtml(params: {
  recipientName: string;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  sandboxBannerHtml?: string;
}): string {
  const safeName = escapeHtml(params.recipientName || "Titular");
  const safeTitle = escapeHtml(params.title || "Actualización de Expediente");
  const safeMessage = escapeHtml(params.message || "").replace(/\n/g, "<br/>");

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${safeTitle} — Global Visa Consulting</title>
      </head>
      <body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
          ${params.sandboxBannerHtml || ""}
          <div style="background:#111315;padding:24px 32px;color:#FFFFFF;">
            <span style="display:inline-block;background:#E11D48;color:#FFFFFF;font-size:10px;font-weight:800;letter-spacing:0.15em;padding:4px 12px;border-radius:999px;text-transform:uppercase;">
              GLOBAL VISA CONSULTING
            </span>
            <h1 style="margin:12px 0 0;font-size:20px;font-weight:800;color:#FFFFFF;">
              ${safeTitle}
            </h1>
          </div>
          <div style="padding:32px;color:#111315;line-height:1.6;font-size:14px;">
            <p style="margin-top:0;">Hola <strong>${safeName}</strong>,</p>
            <p>${safeMessage}</p>
            ${
              params.ctaUrl
                ? `<div style="margin-top:28px;">
                    <a href="${escapeHtml(params.ctaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#E11D48;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;padding:12px 24px;border-radius:999px;">
                      ${escapeHtml(params.ctaLabel || "Abrir mi Portal Privado →")}
                    </a>
                  </div>`
                : ""
            }
            ${
              params.secondaryCtaUrl
                ? `<div style="margin-top:12px;">
                    <a href="${escapeHtml(params.secondaryCtaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#F3F4F6;color:#111315;border:1px solid #D1D5DB;text-decoration:none;font-weight:700;font-size:12px;padding:10px 20px;border-radius:999px;">
                      📅 ${escapeHtml(params.secondaryCtaLabel || "Agregar a mi Google Calendar")}
                    </a>
                  </div>`
                : ""
            }
          </div>
          <div style="background:#F9FAFB;padding:18px 32px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">
            Notificación automática protegida bajo arquitectura Zero-Trust PII • Global Visa Consulting.
          </div>
        </div>
      </body>
    </html>
  `;
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  buildHtmlWithBanner: (bannerHtml: string) => string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "Global Visa Consulting <notificaciones@globalvisaconsult.com>";
  const fallbackAdminEmail =
    process.env.RESEND_FALLBACK_EMAIL || "garayluis0331@gmail.com";

  if (!apiKey) {
    return { delivered: false, mode: "dev-no-api-key" };
  }

  const primaryRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (primaryRes.ok) {
    return { delivered: true, mode: "production" };
  }

  const errBody = await primaryRes.json().catch(() => ({}));

  // Si Resend devuelve 403/422/400 (ej. modo Sandbox o dominio no verificado), reenvía al correo administrador de respaldo
  if (
    (primaryRes.status === 403 ||
      primaryRes.status === 422 ||
      primaryRes.status === 400) &&
    fallbackAdminEmail &&
    params.to.toLowerCase() !== fallbackAdminEmail.toLowerCase()
  ) {
    const bannerHtml = `
      <div style="background:#FEF3C7;color:#92400E;padding:10px 24px;font-size:11px;font-weight:700;border-bottom:1px solid #FDE68A;">
        MODO PRUEBA RESEND: Destinatario original (${escapeHtml(
          params.to
        )}). Verifica tu dominio propio en Resend para envío directo.
      </div>`;

    const retryRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Global Visa Consulting <onboarding@resend.dev>",
        to: [fallbackAdminEmail],
        subject: `[Copia Sandbox para ${params.to}] ${params.subject}`,
        html: params.buildHtmlWithBanner(bannerHtml),
      }),
    });

    if (retryRes.ok) {
      return { delivered: true, mode: "sandbox-fallback" };
    }
  }

  return {
    delivered: false,
    mode: "error",
    error: errBody?.message || `Error HTTP ${primaryRes.status}`,
  };
}

// ============================================================================
// CONTRATO DE ACCIONES PERMITIDAS (RETROCOMPATIBLE + ZERO-TRUST)
// ============================================================================
const ALLOWED_OTP_REQUEST_ACTIONS = new Set([
  "send_otp",
  "request_2fa_otp",
  "generate_otp",
  "request_otp",
]);

const ALLOWED_OTP_VERIFY_ACTIONS = new Set([
  "verify_otp",
  "verify_2fa_otp",
]);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Normalizamos la acción a minúsculas y mapeamos "send_email" -> "send_notification"
    const rawAction = String(
      body?.action || body?.mode || "send_notification"
    )
      .trim()
      .toLowerCase();

    const action =
      rawAction === "send_email" ? "send_notification" : rawAction;

    const reqOrigin = new URL(req.url).origin;

    // 0. RESTABLECIMIENTO / ACTIVACIÓN DE CONTRASEÑA VÍA RESEND + GOOGLE IDENTITY TOOLKIT REST
    if (action === "send_password_reset") {
      const targetEmail = String(body?.email || body?.to || "")
        .trim()
        .toLowerCase();

      if (!targetEmail || !targetEmail.includes("@")) {
        return NextResponse.json(
          { ok: false, error: "Correo inválido." },
          { status: 400 }
        );
      }

      if (!checkRateLimit(`pwd_reset:${targetEmail}`, 4, 60_000)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Demasiados intentos. Espera un minuto.",
          },
          { status: 429 }
        );
      }

      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        return NextResponse.json(
          {
            ok: false,
            fallbackToClientSdk: true,
            error: "FIREBASE_SERVICE_ACCOUNT_KEY no configurada.",
          },
          { status: 501 }
        );
      }

      try {
        const firebaseResetLink =
          await generateFirebasePasswordResetLinkRest(targetEmail);

        if (!firebaseResetLink) {
          return NextResponse.json({ ok: true });
        }

        const parsedFirebaseUrl = new URL(firebaseResetLink);
        const oobCode = parsedFirebaseUrl.searchParams.get("oobCode") || "";

        const originHeader = req.headers.get("origin");
        const baseAppUrl = (
          process.env.NEXT_PUBLIC_APP_URL ||
          originHeader ||
          reqOrigin ||
          "https://globalvisaconsult.com"
        ).replace(/\/$/, "");

        const customResetUrl = `${baseAppUrl}/reset-password?mode=resetPassword&oobCode=${encodeURIComponent(
          oobCode
        )}`;

        const subject =
          "Configura o restablece tu contraseña — Global Visa Consulting";
        const html = buildPasswordResetEmailHtml({
          email: targetEmail,
          resetUrl: customResetUrl,
        });

        await sendViaResend({
          to: targetEmail,
          subject,
          html,
          buildHtmlWithBanner: (bannerHtml) =>
            buildPasswordResetEmailHtml({
              email: targetEmail,
              resetUrl: customResetUrl,
              sandboxBannerHtml: bannerHtml,
            }),
        });

        return NextResponse.json({ ok: true });
      } catch {
        return NextResponse.json({ ok: true });
      }
    }

    // =========================================================================
    // RUTAS AUTENTICADAS (EXIGEN FIREBASE ID TOKEN VÁLIDO)
    // =========================================================================
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const verifiedCaller = await verifyFirebaseIdToken(idToken);
    if (!verifiedCaller) {
      return NextResponse.json(
        { ok: false, error: "No autorizado. Token de sesión inválido." },
        { status: 401 }
      );
    }

    if (!checkRateLimit(`${verifiedCaller.uid}:${action}`, 12, 60_000)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Demasiadas solicitudes seguidas. Espera un minuto antes de intentar nuevamente.",
        },
        { status: 429 }
      );
    }

    // 1. VERIFICAR CÓDIGO 2FA OTP SERVER-SIDE
    if (ALLOWED_OTP_VERIFY_ACTIONS.has(action)) {
      const otpGuess = String(
        body?.otpGuess || body?.code || body?.otp || ""
      ).replace(/\D/g, "");
      const otpChallengeToken = String(
        body?.otpChallengeToken || body?.challengeToken || body?.token || ""
      );

      const check = verifySignedOtpToken(
        otpChallengeToken,
        verifiedCaller.uid,
        verifiedCaller.email,
        otpGuess
      );

      if (!check.valid) {
        return NextResponse.json(
          {
            ok: false,
            valid: false,
            verified: false,
            error:
              check.reason || "Código de verificación inválido o expirado.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        valid: true,
        verified: true,
        twoFactorProof: check.twoFactorProof,
      });
    }

    // 2. GENERAR Y ENVIAR DESAFÍO 2FA OTP SERVER-SIDE
    if (ALLOWED_OTP_REQUEST_ACTIONS.has(action)) {
      const recipientName = String(
        body?.clientName ||
          body?.fullName ||
          body?.recipientName ||
          body?.name ||
          "Titular"
      ).slice(0, 80);

      const otpCode = String(crypto.randomInt(100000, 999999));

      const { token: otpChallengeToken, expiresAt } = createSignedOtpToken(
        verifiedCaller.uid,
        verifiedCaller.email,
        otpCode
      );

      const subject = `Código de acceso: ${otpCode} — Global Visa Consulting`;
      const html = buildOtpEmailHtml({ recipientName, otpCode });

      const sendResult = await sendViaResend({
        to: verifiedCaller.email,
        subject,
        html,
        buildHtmlWithBanner: (bannerHtml) =>
          buildOtpEmailHtml({
            recipientName,
            otpCode,
            sandboxBannerHtml: bannerHtml,
          }),
      });

      const responsePayload: Record<string, unknown> = {
        ok: true,
        simulated: !process.env.RESEND_API_KEY,
        sandboxRedirected: sendResult.mode === "sandbox-fallback",
        otpChallengeToken,
        challengeToken: otpChallengeToken,
        token: otpChallengeToken,
        expiresAt,
        deliveryMode: sendResult.mode,
      };

      if (!process.env.RESEND_API_KEY) {
        responsePayload.devOtpPreview = otpCode;
      }

      return NextResponse.json(responsePayload);
    }

    // 3. NOTIFICACIÓN TRANSACCIONAL (CON VALORES POR DEFECTO RETROCOMPATIBLES)
    if (action === "send_notification") {
      const to = String(body?.to || verifiedCaller.email || "")
        .trim()
        .toLowerCase();
      const recipientName = String(
        body?.clientName ||
          body?.recipientName ||
          body?.fullName ||
          body?.name ||
          "Titular"
      ).slice(0, 100);
      const subject = String(
        body?.subject || "Notificación — Global Visa Consulting"
      ).slice(0, 140);
      const title = String(
        body?.title || "Actualización de Expediente"
      )
        .trim()
        .slice(0, 140);
      const message = String(
        body?.message ||
          body?.body ||
          body?.text ||
          "Tienes una nueva actualización en tu expediente consular."
      )
        .trim()
        .slice(0, 2000);

      if (!to || !to.includes("@")) {
        return NextResponse.json(
          {
            ok: false,
            error: "Solicitud rechazada: destinatario (to) inválido.",
          },
          { status: 400 }
        );
      }

      const ctaLabel = body?.ctaLabel
        ? String(body.ctaLabel).slice(0, 60)
        : undefined;
      const ctaUrl = sanitizeCtaUrl(body?.ctaUrl, reqOrigin);
      const secondaryCtaLabel = body?.secondaryCtaLabel
        ? String(body.secondaryCtaLabel).slice(0, 60)
        : undefined;
      const secondaryCtaUrl = sanitizeCtaUrl(body?.secondaryCtaUrl, reqOrigin);

      const html = buildTransactionalEmailHtml({
        recipientName,
        title,
        message,
        ctaLabel,
        ctaUrl,
        secondaryCtaLabel,
        secondaryCtaUrl,
      });

      const sendResult = await sendViaResend({
        to,
        subject,
        html,
        buildHtmlWithBanner: (bannerHtml) =>
          buildTransactionalEmailHtml({
            recipientName,
            title,
            message,
            ctaLabel,
            ctaUrl,
            secondaryCtaLabel,
            secondaryCtaUrl,
            sandboxBannerHtml: bannerHtml,
          }),
      });

      return NextResponse.json({
        ok: true,
        simulated: !process.env.RESEND_API_KEY,
        sandboxRedirected: sendResult.mode === "sandbox-fallback",
        delivered: sendResult.delivered,
        mode: sendResult.mode,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Acción no reconocida por el servidor: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error interno procesando la notificación.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}