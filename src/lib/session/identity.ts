import { cookies } from "next/headers";
import { ensureUser } from "@/lib/infra/store";
import type { User } from "@/lib/domain/types";

const COOKIE = "topos_uid";

// MVP用の擬似認証: cookie に保存された uid を返す (未設定なら発行)
// 本実装では Auth.js などに差し替える。
export async function currentUser(): Promise<User> {
  const jar = await cookies();
  let uid = jar.get(COOKIE)?.value;
  if (!uid) {
    uid = `u_${Math.random().toString(36).slice(2, 10)}`;
  }
  // ensure
  const u = ensureUser(uid, `名無しの旅人(${uid.slice(-4)})`);
  return u;
}

export async function setIdentityCookie(uid: string) {
  const jar = await cookies();
  jar.set(COOKIE, uid, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
