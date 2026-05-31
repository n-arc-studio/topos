"use client";

import { signOut } from "next-auth/react";

type LogoutButtonProps = {
  className?: string;
  label?: string;
};

export function LogoutButton({
  className,
  label = "ログアウト",
}: LogoutButtonProps = {}) {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
      className={className ?? "hover:text-[var(--accent)] transition"}
    >
      {label}
    </button>
  );
}