"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
            callbackUrl,
          });
          if (!result || result.error) {
            setError("ログインに失敗しました");
            return;
          }
          router.push(result.url || callbackUrl);
          router.refresh();
        });
      }}
    >
      <label className="block text-sm">
        <span className="text-[var(--muted)]">メールアドレス</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mt-1 w-full bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">パスワード</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mt-1 w-full bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !email.trim() || !password}
          className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50"
        >
          ログイン
        </button>
        <Link
          href={`/signup?next=${encodeURIComponent(callbackUrl)}`}
          className="text-xs text-[var(--muted)] hover:underline"
        >
          アカウント作成
        </Link>
        {error && <span className="text-xs text-[var(--warn)]">{error}</span>}
      </div>
    </form>
  );
}