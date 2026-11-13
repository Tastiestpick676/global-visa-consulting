// app/api/notifications/email/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

interface EmailPayload {
  action?: "SEND_EMAIL" | "SEND_OTP" | "VERIFY_OTP";
  to: string;
  subject?: string;
  clientName?: string;
  title?: string;
  message?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  // Para verificación OTP en servidor
  otpGuess?: string;
  otpChallengeToken?: string;
}

const OTP_SECRET =
  process.env.OTP_HMAC_SECRET ||
  process.env.RESEND_API_KEY ||
  "gvc-zero-trust-local-hmac-secret-2026";

function createOtpChallengeToken(email: string, code: string, expiresAt: number): string {
  const data = `${email.toLowerCase()}:${code}:${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", OTP_SECRET)
    .update(data)
    .digest("hex");
  return `${expiresAt}.${signature}`;
}

function verifyOtpChallengeToken(
  email: string,
  guess: string,
  challengeToken: string
): { valid: boolean; reason?: string } {
  const parts = challengeToken.split(".");
  if (parts.length !== 2) return { valid: false, reason: "Token inválido." };

  const [expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || Date.now() > expiresAt) {
    return { valid: false, reason: "El código ha expirado (límite 5 min)." };
  }

  const expectedData = `${email.toLowerCase()}:${guess.trim()}:${expiresAt}`;
  const expectedSig = crypto
    .createHmac("sha256", OTP_SECRET)
    .update(expectedData)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return { valid: false, reason: "El código de 6 dígitos es incorrecto." };
  }

  return { valid: true };
}

/**
 * Verifica que quien llama al endpoint tenga un Firebase ID Token real y activo
 */
async function verifyFirebaseIdToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const idToken = authHeader.replace("Bearer ", "").trim();
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!idToken || !apiKey) return null;

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
    const email = data?.users?.[0]?.email;
    return email ? String(email).toLowerCase() : null;
  } catch {
    return null;
  }
}

function buildEmailHtml(
  params: {
    clientName?: string;
    title?: string;
    message?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    otpCode?: string;
  },
  sandboxNote?: string
) {
  const { clientName, title, message, ctaLabel, ctaUrl, otpCode } = params;
  return `
    <!DOCTYPE html>
    <html lang="es">
      <body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
          ${
            sandboxNote
              ? `<div style="background:#FEF3C7;color:#92400E;padding:10px 24px;font-size:11px;font-weight:700;border-bottom:1px solid #FDE68A;">
                  ${sandboxNote}
                </div>`
              : ""
          }
          <div style="background:#111315;padding:24px 32px;color:#FFFFFF;">
            <span style="display:inline-block;background:#E11D48;color:#FFFFFF;font-size:10px;font-weight:800;letter-spacing:0.15em;padding:4px 12px;border-radius:999px;text-transform:uppercase;">
              GLOBAL VISA CONSULTING
            </span>
            <h1 style="margin:12px 0 0;font-size:20px;font-weight:800;color:#FFFFFF;">
              ${title}
            </h1>
          </div>
          <div style="padding:32px;color:#111315;line-height:1.6;font-size:14px;">
            <p style="margin-top:0;">Hola <strong>${clientName || "Titular"}</strong>,</p>
            <p>${message}</p>
            ${
              otpCode
                ? `<div style="margin:24px 0;padding:20px;background:#F3F4F6;border:2px dashed #E11D48;border-radius:16px;text-align:center;">
                    <span style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#6B7280;letter-spacing:0.1em;">
                      Código de Verificación (Expira en 5 min)
                    </span>
                    <span style="display:block;font-family:monospace;size:32px;font-size:32px;font-weight:800;letter-spacing:0.25em;color:#111315;margin-top:8px;">
                      ${otpCode}
                    </span>
                  </div>`
                : ""
            }
            ${
              ctaUrl
                ? `<div style="margin-top:28px;">
                    <a href="${ctaUrl}" style="display:inline-block;background:#E11D48;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;padding:12px 24px;border-radius:999px;">
                      ${ctaLabel || "Abrir mi Portal Privado →"}
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

export async function POST(request: Request) {
  try {
    // 1. Validar que la petición provenga de un usuario autenticado en Firebase
    const callerEmail = await verifyFirebaseIdToken(
      request.headers.get("authorization")
    );
    if (!callerEmail) {
      return NextResponse.json(
        { ok: false, error: "No autorizado. Token de sesión inválido." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as EmailPayload;
    const action = body.action || "SEND_EMAIL";

    // 2. Acción: VERIFICAR CÓDIGO 2FA EN EL SERVIDOR
    if (action === "VERIFY_OTP") {
      if (!body.otpGuess || !body.otpChallengeToken) {
        return NextResponse.json(
          { ok: false, error: "Faltan datos de verificación 2FA." },
          { status: 400 }
        );
      }
      const verification = verifyOtpChallengeToken(
        callerEmail,
        body.otpGuess,
        body.otpChallengeToken
      );
      if (!verification.valid) {
        return NextResponse.json(
          { ok: false, error: verification.reason },
          { status: 403 }
        );
      }
      return NextResponse.json({ ok: true, verified: true });
    }

    // 3. Si es SEND_OTP, el código de 6 dígitos se genera EXCLUSIVAMENTE en el servidor
    let serverGeneratedOtp: string | undefined;
    let otpChallengeToken: string | undefined;

    if (action === "SEND_OTP") {
      const randomInt = crypto.randomInt(100000, 999999);
      serverGeneratedOtp = String(randomInt);
      const expiresAt = Date.now() + 5 * 60 * 1000;
      otpChallengeToken = createOtpChallengeToken(
        callerEmail,
        serverGeneratedOtp,
        expiresAt
      );
    }

    const to = (body.to || callerEmail).trim().toLowerCase();
    const subject =
      action === "SEND_OTP"
        ? `Código de acceso: ${serverGeneratedOtp} — Global Visa Consulting`
        : body.subject || "Notificación — Global Visa Consulting";
    const title =
      action === "SEND_OTP"
        ? "Código de Verificación de Acceso"
        : body.title || "Actualización de Expediente";
    const message =
      action === "SEND_OTP"
        ? "Ingresa el siguiente código de 6 dígitos para confirmar tu identidad y acceder a tu portal:"
        : body.message || "";

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromAddress =
      process.env.RESEND_FROM_EMAIL ||
      "Global Visa Consulting <onboarding@resend.dev>";
    const fallbackAdminEmail =
      process.env.RESEND_FALLBACK_EMAIL || "garayluis0331@gmail.com";

    if (!resendApiKey) {
      return NextResponse.json({
        ok: true,
        simulated: true,
        otpChallengeToken,
        // Solo en desarrollo local sin RESEND_API_KEY se envía el código de prueba
        devOtpPreview:
          process.env.NODE_ENV === "development"
            ? serverGeneratedOtp
            : undefined,
      });
    }

    const emailHtml = buildEmailHtml({
      clientName: body.clientName,
      title,
      message,
      ctaLabel: body.ctaLabel,
      ctaUrl: body.ctaUrl,
      otpCode: serverGeneratedOtp,
    });

    const primaryRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html: emailHtml,
      }),
    });

    if (primaryRes.ok) {
      return NextResponse.json({
        ok: true,
        simulated: false,
        otpChallengeToken,
      });
    }

    if (
      primaryRes.status === 403 &&
      to !== fallbackAdminEmail.toLowerCase()
    ) {
      const fallbackRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [fallbackAdminEmail],
          subject: `[Copia Sandbox para ${to}] ${subject}`,
          html: buildEmailHtml(
            {
              clientName: body.clientName,
              title,
              message,
              ctaLabel: body.ctaLabel,
              ctaUrl: body.ctaUrl,
              otpCode: serverGeneratedOtp,
            },
            `MODO PRUEBA RESEND: Destinatario original (${to}). Verifica tu dominio propio en Resend para envío directo.`
          ),
        }),
      });

      if (fallbackRes.ok) {
        return NextResponse.json({
          ok: true,
          simulated: false,
          sandboxRedirected: true,
          otpChallengeToken,
        });
      }
    }

    const errText = await primaryRes.text();
    return NextResponse.json(
      { ok: false, error: errText },
      { status: primaryRes.status }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}