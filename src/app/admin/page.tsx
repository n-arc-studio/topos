import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  isPlatformAdmin,
  listSpaces,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

function fmt(ts: number) {
  return new Date(ts).toLocaleString("ja-JP");
}

export default async function AdminPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/admin");
  if (!isPlatformAdmin(me.id)) {
    redirect("/admin/spaces");
  }

  const spaces = listSpaces();

  return (
    <div className="space-y-8">
      <section>
        <Link href="/admin/spaces" className="text-xs text-[var(--muted)] hover:underline">
          ← 場管理へ
        </Link>
        <h1 className="text-2xl font-semibold mt-2">プラットフォーム管理</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          初期管理者の指名と、全体の場の状態確認を行います。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">場の一覧 ({spaces.length})</h2>
        {spaces.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">場がありません。</p>
        ) : (
          <ul className="space-y-2">
            {spaces.map((space) => (
              <li
                key={space.id}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 text-sm"
              >
                <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                  <span>
                    {space.name} <span className="opacity-60">/ {space.id}</span>
                  </span>
                  <span>{space.lifecycle ?? "active"}</span>
                </div>
                <p className="text-xs text-[var(--muted)] mb-2">
                  作成: {fmt(space.createdAt)}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  管理者: {space.adminIds.map((id) => getUser(id)?.displayName ?? id).join(", ")}
                </p>
                <div className="mt-2">
                  <Link
                    href={`/admin/spaces/${space.id}`}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    この場を管理する →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
