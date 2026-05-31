"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function AuthGate({ message }: { message: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const nextPath = `${pathname}${qs ? `?${qs}` : ""}`;

  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
      <p>{message}</p>
      <div className="mt-3 flex items-center gap-3 text-xs">
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="text-[var(--accent)] hover:underline"
        >
          ログイン
        </Link>
        <Link
          href={`/signup?next=${encodeURIComponent(nextPath)}`}
          className="hover:text-[var(--accent)] transition"
        >
          アカウント作成
        </Link>
      </div>
    </div>
  );
}