// app/api/calendar/route.ts
import { NextResponse } from "next/server";

// Convierte links cortos https://calendar.app.google/... en la URL real embebible de Google Calendar
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ resolvedUrl: "" }, { status: 400 });
  }

  try {
    // Escudo de Seguridad SSRF: Solo permitimos dominios oficiales de Google Calendar / Calendly / Cal.com
    const parsed = new URL(targetUrl.trim());
    const allowedDomains = [
      "calendar.app.google",
      "calendar.google.com",
      "calendly.com",
      "cal.com",
    ];
    const isAllowed = allowedDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return NextResponse.json(
        { error: "Dominio de calendario no autorizado por política de seguridad." },
        { status: 403 }
      );
    }

    if (parsed.hostname === "calendar.app.google") {
      const response = await fetch(parsed.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      const finalUrl = new URL(response.url);
      finalUrl.searchParams.set("gv", "true");
      return NextResponse.json({ resolvedUrl: finalUrl.toString() });
    }

    if (parsed.hostname.includes("calendar.google.com")) {
      parsed.searchParams.set("gv", "true");
      return NextResponse.json({ resolvedUrl: parsed.toString() });
    }

    return NextResponse.json({ resolvedUrl: parsed.toString() });
  } catch {
    return NextResponse.json({ resolvedUrl: "" }, { status: 400 });
  }
}