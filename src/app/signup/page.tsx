import Link from "next/link";
import { SignupForm } from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <section>
        <Link href="/" className="text-xs text-[var(--muted)] hover:underline">
          ← 場の一覧
        </Link>
        <h1 className="text-2xl font-semibold mt-2">アカウント作成</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          アカウントを作成すると、記名・匿名の両方で投稿できます。
        </p>
      </section>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        <SignupForm />
      </section>
    </div>
  );
}