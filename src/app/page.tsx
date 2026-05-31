import Link from "next/link";
import {
  listPosts,
  listHotThreads,
  listSpaces,
  listThreads,
  listParticipatingThreads,
  refreshStoreFromPersistence,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";
import { currentTimeMs } from "@/lib/time";
import { MobileMetricOnMount } from "@/components/MobileMetricOnMount";

function timeAgoJP(ts: number, now: number): string {
  const diffMs = now - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}分前`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}時間前`;
  return `${Math.floor(diffMs / day)}日前`;
}

export default async function Home() {
  await refreshStoreFromPersistence();
  const me = await currentUser();
  const spaces = listSpaces();
  const hot = listHotThreads(5);
  const now = currentTimeMs();
  const myThreads = me ? listParticipatingThreads(me.id, 6) : [];

  const threadRows = spaces.flatMap((space) =>
    listThreads(space.id).map((thread) => ({ space, thread }))
  );
  const totalThreads = threadRows.length;
  const totalPosts = threadRows.reduce(
    (sum, row) => sum + listPosts(row.thread.id).length,
    0
  );
  const latestThreads = [...threadRows]
    .sort((a, b) => b.thread.createdAt - a.thread.createdAt)
    .slice(0, 4);

  const avgPostsPerThread =
    totalThreads > 0 ? (totalPosts / totalThreads).toFixed(1) : "0.0";

  return (
    <div className="space-y-8">
      <MobileMetricOnMount name="home_view" />
      <section className="home-hero rounded-2xl border border-[var(--border)] p-5 md:p-6 overflow-hidden relative">
        <div className="home-hero-glow" aria-hidden="true" />
        <div className="relative z-[1] space-y-5">
          <div className="space-y-2">
            <p className="text-xs tracking-[0.18em] uppercase text-[var(--muted)]">
              Topos Signal Board
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold leading-tight">
              場の重力を、
              <span className="text-[var(--accent)]">観測して参加する</span>
            </h1>
            <p className="text-sm md:text-base text-[var(--muted)] leading-relaxed max-w-2xl">
              いま動いている話題から入って、重力の高い会話に接続する。
              Toposは「反応の数」ではなく「文脈への寄与」で場を育てるSNSです。
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <MetricCard label="アクティブな場" value={`${spaces.length}`} />
            <MetricCard label="スレッド数" value={`${totalThreads}`} />
            <MetricCard label="投稿総数" value={`${totalPosts}`} />
            <MetricCard label="平均投稿密度" value={`${avgPostsPerThread}/スレ`} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={hot[0] ? `/spaces/${hot[0].space.id}/threads/${hot[0].thread.id}` : "/about"}
              className="px-3 py-2 text-sm rounded-md bg-[var(--accent)] text-black font-medium hover:opacity-90 transition"
            >
              いま熱いスレに入る
            </Link>
            <Link
              href="/about"
              className="px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              思想と使い方を読む
            </Link>
          </div>
        </div>
      </section>

      {me && (
        <section
          id="your-threads"
          className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4"
        >
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium text-[var(--muted)]">
              あなたが参加した議論の続き
            </h2>
            <span className="text-xs text-[var(--muted)]">
              文脈の更新を追う
            </span>
          </div>

          {myThreads.length === 0 ? (
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              まだ参加した議論がありません。気になる場のスレッドに一言残すと、
              その後の動きがここに流れてきます。
            </p>
          ) : (
            <ul className="space-y-2 min-w-0">
              {myThreads.map((row) => (
                <li key={row.thread.id} className="min-w-0">
                  <Link
                    href={`/spaces/${row.space.id}/threads/${row.thread.id}`}
                    className="group block rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 hover:border-[var(--accent)] transition"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        <span className="text-xs text-[var(--muted)] mr-2">
                          {row.space.name}
                        </span>
                        {row.thread.title}
                      </span>
                      <span className="text-xs text-[var(--muted)] whitespace-nowrap">
                        {timeAgoJP(row.lastPostAt, now)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      {row.newSinceMine > 0 ? (
                        <span className="text-[var(--accent)]">
                          あなたの投稿後に {row.newSinceMine} 件
                          {row.newReplierCount > 1
                            ? `・${row.newReplierCount} 人`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">新しい動きなし</span>
                      )}
                      {row.isReemergence && (
                        <span className="rounded-full border border-[var(--accent)] px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                          再点火
                        </span>
                      )}
                    </div>

                    {row.preview && (
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        最新: {row.lastPostBy}「{row.preview}」
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {hot.length > 0 && (
        <section id="hot-topics" className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium text-[var(--muted)]">
              いま動きのある話題
            </h2>
            <span className="text-xs text-[var(--muted)]">HOT {hot.length}</span>
          </div>
          <ul className="space-y-2 min-w-0">
            {hot.map((h, idx) => (
              <li key={h.thread.id} className="min-w-0">
                <Link
                  href={`/spaces/${h.space.id}/threads/${h.thread.id}`}
                  className="group flex min-w-0 items-baseline justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-[var(--border)] hover:bg-[var(--panel-2)] hover:text-[var(--accent)] transition"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-[var(--muted)] mr-2">
                      {idx + 1}.
                    </span>
                    <span className="text-[var(--muted)] mr-2">
                      {h.space.name}
                    </span>
                    {h.thread.title}
                  </span>
                  <span className="text-xs text-[var(--muted)] whitespace-nowrap">
                    {h.postCount} 投稿
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {latestThreads.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="text-sm font-medium text-[var(--muted)] mb-3">
            新着スレッド
          </h2>
          <ul className="grid gap-2 min-w-0">
            {latestThreads.map(({ space, thread }) => (
              <li key={thread.id} className="min-w-0">
                <Link
                  href={`/spaces/${space.id}/threads/${thread.id}`}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 hover:border-[var(--accent)] transition"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-xs text-[var(--muted)] mr-2">{space.name}</span>
                    <span className="text-sm">{thread.title}</span>
                  </span>
                  <span className="text-xs text-[var(--muted)] whitespace-nowrap">
                    {timeAgoJP(thread.createdAt, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="spaces" className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">場の一覧</h2>
          <p className="text-xs text-[var(--muted)]">
            場は「文脈の宇宙」。それぞれの場には憲章と管理者がいる。
          </p>
        </div>

        <ul className="space-y-3">
        {spaces.map((s) => {
          const threads = listThreads(s.id);
          const postCount = threads.reduce(
            (sum, thread) => sum + listPosts(thread.id).length,
            0
          );
          return (
            <li
              key={s.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 hover:bg-[var(--panel-2)] transition"
            >
              <Link href={`/spaces/${s.id}`} className="block">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                  <h2 className="font-medium break-words">{s.name}</h2>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                    <span>{threads.length} スレ</span>
                    <span>•</span>
                    <span>{postCount} 投稿</span>
                  </div>
                </div>
                <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
                  {s.charter}
                </p>
              </Link>
            </li>
          );
        })}
        </ul>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
      <p className="text-[11px] text-[var(--muted)] leading-none">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-none">{value}</p>
    </div>
  );
}
