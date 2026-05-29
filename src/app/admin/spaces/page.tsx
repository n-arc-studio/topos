import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSpace, isAnyAdmin, isPlatformAdmin } from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

export default async function SpaceAdminIndexPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/admin/spaces");
  if (!isAnyAdmin(me.id) && !isPlatformAdmin(me.id)) notFound();

  const spaces = me.isAdminOf.map((sid) => getSpace(sid)).filter((s) => !!s);

  return (
    <div className="space-y-6">
      <section>
        <Link href="/" className="text-xs text-[var(--muted)] hover:underline">
          ← 場の一覧
        </Link>
        <h1 className="text-2xl font-semibold mt-2">場管理</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          あなたが管理権限を持つ場を選択してください。
        </p>
      </section>

      {isPlatformAdmin(me.id) && (
        <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 text-sm">
          <p className="text-[var(--muted)]">
            プラットフォーム管理者です。全体管理ページから初期管理者の指名を行えます。
          </p>
          <Link href="/admin" className="text-xs text-[var(--accent)] hover:underline">
            全体管理を開く →
          </Link>
        </section>
      )}

      <section className="space-y-2">
        {spaces.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">管理可能な場はありません。</p>
        ) : (
          <ul className="space-y-2">
            {spaces.map((space) => (
              <li
                key={space.id}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3"
              >
                <div className="text-sm font-medium">{space.name}</div>
                <div className="text-xs text-[var(--muted)]">{space.id}</div>
                <div className="mt-2">
                  <Link
                    href={`/admin/spaces/${space.id}`}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    場管理ページを開く →
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
