import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session/identity";
import { ProfileForm } from "@/components/ProfileForm";
import {
  listUserBadges,
  listPosts,
  listSpaces,
  listThreads,
  listUsers,
  refreshStoreFromPersistence,
} from "@/lib/infra/store";

export default async function ProfilePage() {
  await refreshStoreFromPersistence();
  const me = await currentUser();
  if (!me) redirect("/login?next=/profile");

  const spaces = listSpaces();
  const allPosts = spaces.flatMap((space) =>
    listThreads(space.id).flatMap((thread) => listPosts(thread.id))
  );
  const myPosts = allPosts.filter((post) => post.authorId === me.id);
  const now = Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStartMs = today.getTime();
  const weekStartMs = now - 7 * 24 * 60 * 60 * 1000;
  const prevWeekStartMs = now - 14 * 24 * 60 * 60 * 1000;
  const myTodayPosts = myPosts.filter((p) => p.createdAt >= todayStartMs).length;
  const myWeekPosts = myPosts.filter((p) => p.createdAt >= weekStartMs).length;
  const myPrevWeekPosts = myPosts.filter(
    (p) => p.createdAt >= prevWeekStartMs && p.createdAt < weekStartMs
  ).length;

  const qualityOf = (post: (typeof myPosts)[number]) =>
    (post.reactions.useful ?? 0) + (post.reactions.agree ?? 0);
  const myQualitySignals = myPosts.reduce((sum, post) => sum + qualityOf(post), 0);
  const myWeekQualitySignals = myPosts
    .filter((p) => p.createdAt >= weekStartMs)
    .reduce((sum, post) => sum + qualityOf(post), 0);
  const myPrevWeekQualitySignals = myPosts
    .filter((p) => p.createdAt >= prevWeekStartMs && p.createdAt < weekStartMs)
    .reduce((sum, post) => sum + qualityOf(post), 0);

  const thisWeekProgressScore = myWeekPosts + myWeekQualitySignals;
  const prevWeekProgressScore = myPrevWeekPosts + myPrevWeekQualitySignals;
  const weeklyProgressDelta = thisWeekProgressScore - prevWeekProgressScore;

  const directRepliersByPost = new Map<string, Set<string>>();
  for (const post of allPosts) {
    if (!post.replyTo) continue;
    const set = directRepliersByPost.get(post.replyTo) ?? new Set<string>();
    set.add(post.authorId);
    directRepliersByPost.set(post.replyTo, set);
  }
  const maxDirectRepliers = myPosts.reduce((max, post) => {
    const count = directRepliersByPost.get(post.id)?.size ?? 0;
    return Math.max(max, count);
  }, 0);

  const postedDayKeys = new Set(
    myPosts.map((post) => {
      const d = new Date(post.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    })
  );
  let postingStreakDays = 0;
  for (let i = 0; i < 365; i++) {
    const day = new Date(todayStartMs - i * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    if (!postedDayKeys.has(key)) break;
    postingStreakDays += 1;
  }

  const rankedUsers = listUsers()
    .map((u) => ({
      user: u,
      totalMass: (u.publicMass ?? 0) + (u.anonymousMass ?? 0),
    }))
    .sort((a, b) => b.totalMass - a.totalMass);

  const meMassEntry = rankedUsers.find((entry) => entry.user.id === me.id);
  const myTotalMass = meMassEntry?.totalMass ?? 0;
  const meMassRank = rankedUsers.findIndex((entry) => entry.user.id === me.id) + 1;
  const nextRankMass =
    meMassRank > 1 ? rankedUsers[meMassRank - 2]?.totalMass : undefined;
  const rankGap =
    typeof nextRankMass === "number"
      ? Math.max(0, nextRankMass - myTotalMass)
      : 0;

  const MASS_MILESTONES = [
    10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
  ];
  const nextMilestone =
    MASS_MILESTONES.find((m) => m > myTotalMass) ??
    Math.ceil((myTotalMass + 1) / 5000) * 5000;
  const massToNextMilestone = Math.max(0, nextMilestone - myTotalMass);
  const milestoneProgress =
    nextMilestone > 0
      ? Math.min(100, (myTotalMass / nextMilestone) * 100)
      : 0;

  const missionChecks = [
    {
      label: "『参考になった』『なるほど』を3つ集める",
      done: myQualitySignals >= 3,
      detail: `いま ${myQualitySignals}/3`,
    },
    {
      label: "2人以上から返信がつく投稿を1件つくる",
      done: maxDirectRepliers >= 2,
      detail: `最大 ${maxDirectRepliers}/2 人`,
    },
    {
      label: "7日で3件投稿する",
      done: myWeekPosts >= 3,
      detail: `現在 ${myWeekPosts}/3 投稿`,
    },
  ];
  const missionCompleted = missionChecks.filter((m) => m.done).length;
  const badges = listUserBadges(me.id, now);
  const DAY_MS = 24 * 60 * 60 * 1000;

  function badgeSymbol(kind: string): string {
    if (kind === "quality_contributor") return "◉";
    if (kind === "conversation_catalyst") return "◎";
    return "○";
  }

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

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
        <h2 className="text-sm font-semibold">分野別の信頼証明バッジ</h2>
        {badges.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">
            まだバッジはありません。直近90日の寄与で自動付与されます。
          </p>
        ) : (
          <div className="space-y-2">
            {badges.map((badge) => {
              const daysLeft = Math.max(
                0,
                Math.ceil((badge.expiresAt - now) / DAY_MS)
              );
              const isNearExpiry = daysLeft <= 14;
              const statusClass = isNearExpiry
                ? "border-[var(--warn)] text-[var(--warn)]"
                : "border-[var(--border)] text-[var(--muted)]";

              return (
                <article
                  key={badge.id}
                  className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--accent)] text-[var(--accent)] font-medium">
                      {badgeSymbol(badge.kind)} {badge.label}
                    </span>
                    <span className="text-xs text-[var(--muted)]">{badge.spaceName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusClass}`}>
                      {isNearExpiry ? `期限まで${daysLeft}日` : `有効 ${daysLeft}日`}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{badge.reason}</p>
                  <p className="text-[10px] text-[var(--muted)]">
                    有効期限: {new Date(badge.expiresAt).toLocaleDateString("ja-JP")}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
        <h2 className="text-sm font-semibold">質量ブーストミッション</h2>
        <p className="text-xs text-[var(--muted)]">
          次の節目 {nextMilestone.toFixed(0)} mass まで
          <span className="text-[var(--foreground)] font-medium">
            {" "}
            +{massToNextMilestone.toFixed(2)}
          </span>
        </p>
        <div className="h-2 rounded-full bg-[var(--panel-2)] overflow-hidden border border-[var(--border)]">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-700"
            style={{ width: `${milestoneProgress.toFixed(1)}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <span>
            現在 {myTotalMass.toFixed(2)} / {nextMilestone.toFixed(0)} mass
          </span>
          <span>連続投稿日数 {postingStreakDays}日</span>
          <span>
            先週比進捗 {weeklyProgressDelta >= 0 ? "+" : ""}
            {weeklyProgressDelta}
          </span>
        </div>

        <div className="space-y-1.5">
          {missionChecks.map((mission) => (
            <div
              key={mission.label}
              className="flex items-center justify-between gap-3 rounded border border-[var(--border)] px-2 py-1 text-xs"
            >
              <span
                className={
                  mission.done
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }
              >
                {mission.done ? "✓" : "○"} {mission.label}
              </span>
              <span className="text-[var(--muted)]">{mission.detail}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--muted)]">
          進捗 {missionCompleted}/{missionChecks.length}
        </p>
        <details>
          <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
            比較指標 (任意)
          </summary>
          <div className="mt-1 text-xs text-[var(--muted)] space-y-1">
            <p>
              順位 {meMassRank}位
              {meMassRank > 1 ? ` / 次順位まで +${rankGap.toFixed(2)} mass` : ""}
            </p>
            <p>
              今週スコア {thisWeekProgressScore} (投稿 {myWeekPosts} + 参考/共感リアクション {myWeekQualitySignals})
            </p>
            <p>
              先週スコア {prevWeekProgressScore} (投稿 {myPrevWeekPosts} + 参考/共感リアクション {myPrevWeekQualitySignals})
            </p>
            <p>
              今日の投稿 {myTodayPosts}件
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}
