"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
      className="hover:text-[var(--accent)] transition"
    >
      ログアウト
    </button>
  );
}