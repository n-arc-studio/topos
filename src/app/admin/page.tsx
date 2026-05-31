import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  isPlatformAdmin,
  listPosts,
  listSpaces,
  listThreads,
  listUsers,
  refreshStoreFromPersistence,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";
import { AdminSpaceCreateForm } from "@/components/AdminSpaceCreateForm";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { currentTimeMs } from "@/lib/time";

function fmt(ts: number) {
  return new Date(ts).toLocaleString("ja-JP");
}

export default async function AdminPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/admin");
  if (!isPlatformAdmin(me.id)) {
    redirect("/admin/spaces");
  }

  await refreshStoreFromPersistence();

  const spaces = listSpaces();
  const users = listUsers();
  const now = currentTimeMs();
  const activeWindowMs = 7 * 24 * 60 * 60 * 1000;

  const allPosts = spaces.flatMap((space) =>
    listThreads(space.id).flatMap((thread) => listPosts(thread.id))
  );

  const postStatsByUser = new Map<
    string,
    { postCount: number; namedCount: number; anonymousCount: number; lastPostAt?: number }
  >();
  for (const post of allPosts) {
    const current = postStatsByUser.get(post.authorId) ?? {
      postCount: 0,
      namedCount: 0,
      anonymousCount: 0,
      lastPostAt: undefined,
    };
    current.postCount += 1;
    if (post.identityMode === "named") current.namedCount += 1;
    else current.anonymousCount += 1;
    current.lastPostAt = Math.max(current.lastPostAt ?? 0, post.createdAt);
    postStatsByUser.set(post.authorId, current);
  }

  const activeUserCount7d = users.filter((u) => {
    const last = postStatsByUser.get(u.id)?.lastPostAt;
    return typeof last === "number" && now - last <= activeWindowMs;
  }).length;
  const platformAdminCount = users.filter((u) => isPlatformAdmin(u.id)).length;
  const spaceAdminCount = users.filter((u) => u.isAdminOf.length > 0).length;

  const userRows = users
    .map((u) => {
      const stat = postStatsByUser.get(u.id);
      const totalMass = (u.publicMass ?? 0) + (u.anonymousMass ?? 0);
      return {
        user: u,
        totalMass,
        postCount: stat?.postCount ?? 0,
        namedCount: stat?.namedCount ?? 0,
        anonymousCount: stat?.anonymousCount ?? 0,
        lastPostAt: stat?.lastPostAt,
      };
    })
    .sort((a, b) => b.totalMass - a.totalMass);

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
        <AdminSpaceCreateForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">ユーザー統計</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard label="総ユーザー" value={`${users.length}`} />
          <StatCard label="直近7日アクティブ" value={`${activeUserCount7d}`} />
          <StatCard label="場管理者" value={`${spaceAdminCount}`} />
          <StatCard label="全体管理者" value={`${platformAdminCount}`} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium">ユーザー一覧 ({users.length})</h2>
          <p className="text-xs text-[var(--muted)]">並び順: 総質量の高い順</p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs text-[var(--muted)] border-b border-[var(--border)]">
              <tr>
                <th className="text-left px-3 py-2">ユーザー</th>
                <th className="text-left px-3 py-2">権限</th>
                <th className="text-right px-3 py-2">質量(公/匿)</th>
                <th className="text-right px-3 py-2">投稿(記名/匿名)</th>
                <th className="text-left px-3 py-2">最終投稿</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((row) => {
                const roleText = isPlatformAdmin(row.user.id)
                  ? "全体管理者"
                  : row.user.isAdminOf.length > 0
                    ? `場管理者 (${row.user.isAdminOf.length})`
                    : "一般";
                return (
                  <tr key={row.user.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{row.user.displayName}</div>
                      <div className="text-xs text-[var(--muted)]">{row.user.id}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-[var(--muted)]">
                      {roleText}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <div>{row.totalMass.toFixed(1)}</div>
                      <div className="text-xs text-[var(--muted)]">
                        公 {row.user.publicMass.toFixed(1)} / 匿 {row.user.anonymousMass.toFixed(1)}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <div>{row.postCount}</div>
                      <div className="text-xs text-[var(--muted)]">
                        記名 {row.namedCount} / 匿名 {row.anonymousCount}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-[var(--muted)] whitespace-nowrap">
                      {typeof row.lastPostAt === "number" ? fmt(row.lastPostAt) : "投稿なし"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
                <div className="mb-1 flex flex-col gap-1 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
                  <span className="break-all">
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
                <div className="mt-2">
                  <AdminDeleteButton
                    endpoint={`/api/spaces/${space.id}`}
                    label="この場を削除"
                    confirmMessage={`場「${space.name}」を削除します。配下のスレッドとコメントも全て削除されます。よろしいですか?`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
      <p className="text-[11px] text-[var(--muted)] leading-none">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-none">{value}</p>
    </div>
  );
}
