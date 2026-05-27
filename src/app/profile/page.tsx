import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session/identity";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/profile");
  return (
    <div className="space-y-6">
      <section>
        <Link href="/" className="text-xs text-[var(--muted)] hover:underline">
          ← 場の一覧
        </Link>
        <h1 className="text-2xl font-semibold mt-2">プロフィール</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          記名で投稿したときに表示される名前を編集できます。
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        <ProfileForm initialName={me.displayName} />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 text-sm space-y-2">
        <div>
          <span className="text-[var(--muted)]">内部ID:</span>{" "}
          <code className="text-xs">{me.id}</code>
        </div>
        <div>
          <span className="text-[var(--muted)]">公開質量:</span>{" "}
          <span className="text-[var(--foreground)]">{me.publicMass}</span>
        </div>
        <div>
          <span className="text-[var(--muted)]">匿名質量:</span>{" "}
          <span className="text-[var(--foreground)]">{me.anonymousMass}</span>
        </div>
        {me.isAdminOf.length > 0 && (
          <div>
            <span className="text-[var(--muted)]">管理者の場:</span>{" "}
            <span className="text-[var(--accent)]">
              {me.isAdminOf.join(", ")}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
