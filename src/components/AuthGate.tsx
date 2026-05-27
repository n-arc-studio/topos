import Link from "next/link";

export function AuthGate({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
      <p>{message}</p>
      <div className="mt-3 flex items-center gap-3 text-xs">
        <Link href="/login" className="text-[var(--accent)] hover:underline">
          ログイン
        </Link>
        <Link href="/signup" className="hover:text-[var(--accent)] transition">
          アカウント作成
        </Link>
      </div>
    </div>
  );
}