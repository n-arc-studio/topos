import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="space-y-6">
      <section>
        <Link href="/" className="text-xs text-[var(--muted)] hover:underline">
          ← 場の一覧
        </Link>
        <h1 className="text-2xl font-semibold mt-2">ログイン</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          投稿やプロフィール編集にはアカウントが必要です。
        </p>
      </section>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        <LoginForm callbackUrl={next || "/"} />
      </section>
    </div>
  );
}