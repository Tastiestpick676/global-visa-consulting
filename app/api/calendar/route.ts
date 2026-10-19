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
    if (targetUrl.includes("calendar.app.google")) {
      const response = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      const finalUrl = new URL(response.url);
      // gv=true habilita el modo limpio embebible de Google Appointment Schedule
      finalUrl.searchParams.set("gv", "true");
      return NextResponse.json({ resolvedUrl: finalUrl.toString() });
    }

    if (targetUrl.includes("calendar.google.com/calendar/appointments")) {
      const finalUrl = new URL(targetUrl);
      finalUrl.searchParams.set("gv", "true");
      return NextResponse.json({ resolvedUrl: finalUrl.toString() });
    }

    return NextResponse.json({ resolvedUrl: targetUrl });
  } catch {
    return NextResponse.json({ resolvedUrl: targetUrl });
  }
}