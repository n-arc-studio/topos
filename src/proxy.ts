import { NextRequest, NextResponse } from "next/server";

const COOKIE = "topos_uid";

export function proxy(req: NextRequest) {
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing) return NextResponse.next();

  const uid = `u_${Math.random().toString(36).slice(2, 10)}`;
  const res = NextResponse.next({
    request: {
      headers: (() => {
        const h = new Headers(req.headers);
        // cookies()がこのリクエスト中に値を返せるよう、リクエストにもセット
        h.append("cookie", `${COOKIE}=${uid}`);
        return h;
      })(),
    },
  });
  res.cookies.set({
    name: COOKIE,
    value: uid,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export const config = {
  // _next/, favicon等を除外
  matcher: ["/((?!_next/|favicon|.*\\.(?:png|jpg|svg|ico)).*)"],
};
