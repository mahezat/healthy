import { NextResponse, type NextRequest } from "next/server";

// Keeps strangers from using your Gemini key: if APP_PASSCODE is set in Vercel,
// every /api call needs the passcode (cookie from /api/unlock, or an x-app-key header).
export function proxy(req: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  // /api/status stays open so you can check the setup from a browser; it hides details when locked.
  if (!passcode || req.nextUrl.pathname === "/api/unlock" || req.nextUrl.pathname === "/api/status") return NextResponse.next();
  const given = req.cookies.get("app_key")?.value ?? req.headers.get("x-app-key");
  if (given === passcode) return NextResponse.next();
  return NextResponse.json({ error: "Locked. Enter your passcode." }, { status: 401 });
}

export const config = { matcher: "/api/:path*" };
