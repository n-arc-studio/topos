"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SignupForm({ callbackUrl = "/" }: { callbackUrl?: string }) {
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
          const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const json = await res.json();
          if (!res.ok) {
            setError(json.error ?? "登録に失敗しました");
            return;
          }
          const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
            callbackUrl,
          });
          if (!result || result.error) {
            setError("登録後のログインに失敗しました");
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
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !email.trim() || password.length < 8}
          className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50"
        >
          アカウント作成
        </button>
        <Link
          href={`/login?next=${encodeURIComponent(callbackUrl)}`}
          className="text-xs text-[var(--muted)] hover:underline"
        >
          既にアカウントがある
        </Link>
        {error && <span className="text-xs text-[var(--warn)]">{error}</span>}
      </div>
    </form>
  );
}