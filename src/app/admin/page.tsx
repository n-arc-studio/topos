import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPost,
  getSpace,
  getUser,
  isAnyAdmin,
  listModerationLog,
  listReportedPosts,
  listSunkPosts,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";
import { ModerateButton } from "@/components/ModerateButton";
import { SpaceConfigForm } from "@/components/SpaceConfigForm";

function fmt(ts: number) {
  return new Date(ts).toLocaleString("ja-JP");
}

export default async function AdminPage() {
  const me = await currentUser();
  if (!isAnyAdmin(me.id)) notFound();

  const spaceIds = me.isAdminOf;
  const reported = listReportedPosts(spaceIds);
  const sunk = listSunkPosts(spaceIds);
  const log = listModerationLog(spaceIds, 50);

  return (
    <div className="space-y-8">
      <section>
        <Link href="/" className="text-xs text-[var(--muted)] hover:underline">
          ← 場の一覧
        </Link>
        <h1 className="text-2xl font-semibold mt-2">管理コンソール</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          あなたが管理者を務める場の運用情報を表示しています。
        </p>
        <p className="text-xs text-[var(--muted)] mt-2">
          対象の場: {spaceIds.join(", ") || "(なし)"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">場の物理係数</h2>
        <p className="text-xs text-[var(--muted)]">
          各場の重力パラメータを上書きできます。空欄は既定値が使われます。
        </p>
        <div className="space-y-3">
          {spaceIds.map((sid) => {
            const sp = getSpace(sid);
            if (!sp) return null;
            return (
              <SpaceConfigForm
                key={sid}
                spaceId={sid}
                spaceName={sp.name}
                initial={sp.gravityConfig ?? null}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">通報のある投稿 ({reported.length})</h2>
        {reported.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">通報はありません。</p>
        ) : (
          <ul className="space-y-2">
            {reported.map((p) => {
              const space = getSpace(p.spaceId);
              const author = getUser(p.authorId);
              return (
                <li
                  key={p.id}
                  className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3"
                >
                  <div className="text-xs text-[var(--muted)] flex justify-between mb-1">
                    <span>
                      {space?.name ?? p.spaceId}{" "}
                      <span className="opacity-60">/ {p.threadId}</span>
                    </span>
                    <span className="text-[var(--warn)]">
                      通報 {p.reportCount}
                      {p.isSunk && " · 沈降中"}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{p.body}</p>
                  <div className="mt-2 text-xs text-[var(--muted)] flex flex-wrap items-center gap-3">
                    <span>
                      著者: {author?.displayName ?? p.authorId}{" "}
                      <span className="opacity-60">({p.identityMode})</span>
                    </span>
                    <Link
                      href={`/spaces/${p.spaceId}/threads/${p.threadId}`}
                      className="hover:text-[var(--accent)] transition"
                    >
                      スレッドを開く →
                    </Link>
                    {!p.isSunk ? (
                      <ModerateButton
                        postId={p.id}
                        action="sink"
                        label="沈降させる"
                        variant="warn"
                      />
                    ) : (
                      <ModerateButton
                        postId={p.id}
                        action="unsink"
                        label="沈降解除"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">沈降している投稿 ({sunk.length})</h2>
        {sunk.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">沈降中の投稿はありません。</p>
        ) : (
          <ul className="space-y-2">
            {sunk.map((p) => {
              const space = getSpace(p.spaceId);
              return (
                <li
                  key={p.id}
                  className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 opacity-80"
                >
                  <div className="text-xs text-[var(--muted)] flex justify-between mb-1">
                    <span>
                      {space?.name ?? p.spaceId}{" "}
                      <span className="opacity-60">/ {p.threadId}</span>
                    </span>
                    <span>{fmt(p.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{p.body}</p>
                  <div className="mt-2 text-xs flex flex-wrap items-center gap-3">
                    <Link
                      href={`/spaces/${p.spaceId}/threads/${p.threadId}`}
                      className="text-[var(--muted)] hover:text-[var(--accent)] transition"
                    >
                      スレッドを開く →
                    </Link>
                    <ModerateButton
                      postId={p.id}
                      action="unsink"
                      label="沈降解除"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">モデレーション履歴 ({log.length})</h2>
        {log.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">履歴はありません。</p>
        ) : (
          <ul className="space-y-2">
            {log.map((m) => {
              const post = m.postId ? getPost(m.postId) : undefined;
              const space = getSpace(m.spaceId);
              return (
                <li
                  key={m.id}
                  className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 text-sm"
                >
                  <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                    <span>
                      {space?.name ?? m.spaceId}{" "}
                      <span className="opacity-60">/ {m.kind}</span>
                    </span>
                    <span>{fmt(m.at)}</span>
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    by {m.byUserId}
                  </div>
                  {post && (
                    <p className="mt-1 text-[var(--muted)] truncate">
                      {post.body.slice(0, 80)}
                      {post.body.length > 80 && "..."}
                    </p>
                  )}
                  {m.note && (
                    <p className="mt-1 text-xs text-[var(--warn)]">
                      {m.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
