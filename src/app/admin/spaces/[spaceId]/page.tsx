import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getPost,
  getSpace,
  getThread,
  getUser,
  isAdmin,
  isPlatformAdmin,
  listThreads,
  listPosts,
  listModerationLog,
  listReportedPosts,
  listSunkPosts,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";
import { ModerateButton } from "@/components/ModerateButton";
import { SpaceCharterForm } from "@/components/SpaceCharterForm";
import { SpaceConfigForm } from "@/components/SpaceConfigForm";
import { AdminRoleForm } from "@/components/AdminRoleForm";
import { NewThreadForm } from "@/components/NewThreadForm";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

function fmt(ts: number) {
  return new Date(ts).toLocaleString("ja-JP");
}

export default async function SpaceAdminPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const me = await currentUser();
  if (!me) redirect(`/login?next=/admin/spaces/${spaceId}`);

  const space = getSpace(spaceId);
  if (!space) notFound();

  const canAccess = isAdmin(me.id, spaceId) || isPlatformAdmin(me.id);
  if (!canAccess) notFound();

  const reported = listReportedPosts([spaceId]);
  const sunk = listSunkPosts([spaceId]);
  const log = listModerationLog([spaceId], 50);
  const threads = listThreads(spaceId);
  const comments = threads
    .flatMap((thread) => listPosts(thread.id))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 80);

  return (
    <div className="space-y-8">
      <section>
        <Link href="/admin/spaces" className="text-xs text-[var(--muted)] hover:underline">
          ← 場管理の一覧
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{space.name} の管理</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          場ごとの権限管理、重力係数、投稿モデレーションを行います。
        </p>
        <p className="text-xs text-[var(--muted)] mt-2">
          lifecycle: {space.lifecycle ?? "active"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">場の管理者</h2>
        <ul className="space-y-2">
          {space.adminIds.map((id) => {
            const user = getUser(id);
            return (
              <li
                key={id}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 text-sm"
              >
                <div className="font-medium">{user?.displayName ?? id}</div>
                <div className="text-xs text-[var(--muted)]">{id}</div>
              </li>
            );
          })}
        </ul>
        <AdminRoleForm spaceId={spaceId} selfUserId={me.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">場の憲章</h2>
        <p className="text-xs text-[var(--muted)]">
          この場の目的や守る文脈を編集できます。変更は公開ページにも反映されます。
        </p>
        <SpaceCharterForm
          spaceId={spaceId}
          spaceName={space.name}
          initialCharter={space.charter}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">場の物理係数</h2>
        <p className="text-xs text-[var(--muted)]">
          この場の重力パラメータを上書きできます。空欄は既定値が使われます。
        </p>
        <SpaceConfigForm
          spaceId={spaceId}
          spaceName={space.name}
          initial={space.gravityConfig ?? null}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">スレッド管理 ({threads.length})</h2>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
          <p className="text-xs text-[var(--muted)] mb-2">
            この場の管理画面から新しいスレッド作成と不要スレッドの削除ができます。
          </p>
          <NewThreadForm spaceId={spaceId} />
        </div>
        {threads.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">スレッドはありません。</p>
        ) : (
          <ul className="space-y-2">
            {threads.map((thread) => (
              <li
                key={thread.id}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/spaces/${spaceId}/threads/${thread.id}`}
                    className="font-medium hover:text-[var(--accent)] transition"
                  >
                    {thread.title}
                  </Link>
                  <span className="text-xs text-[var(--muted)]">{fmt(thread.createdAt)}</span>
                </div>
                <div className="mt-2 text-xs flex flex-wrap items-center gap-3">
                  <span className="text-[var(--muted)]">{thread.id}</span>
                  <AdminDeleteButton
                    endpoint={`/api/threads/${thread.id}`}
                    label="スレッド削除"
                    confirmMessage={`スレッド「${thread.title}」を削除します。配下のコメントも全て削除されます。よろしいですか?`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">コメント削除 ({comments.length})</h2>
        <p className="text-xs text-[var(--muted)]">
          直近コメントを表示しています。削除時は対象コメントの返信ツリーも同時に削除されます。
        </p>
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">コメントはありません。</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((comment) => {
              const author = getUser(comment.authorId);
              const thread = getThread(comment.threadId);
              return (
                <li
                  key={comment.id}
                  className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)] mb-1">
                    <span>
                      {thread?.title ?? comment.threadId}
                      <span className="opacity-60"> / {comment.id}</span>
                    </span>
                    <span>{fmt(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                  <div className="mt-2 text-xs flex flex-wrap items-center gap-3">
                    <span className="text-[var(--muted)]">
                      著者: {author?.displayName ?? comment.authorId}
                    </span>
                    <Link
                      href={`/spaces/${spaceId}/threads/${comment.threadId}`}
                      className="hover:text-[var(--accent)] transition"
                    >
                      スレッドを開く →
                    </Link>
                    <AdminDeleteButton
                      endpoint={`/api/posts/${comment.id}`}
                      label="コメント削除"
                      confirmMessage="コメントを削除します。返信がある場合は返信ツリーも削除されます。よろしいですか?"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">通報のある投稿 ({reported.length})</h2>
        {reported.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">通報はありません。</p>
        ) : (
          <ul className="space-y-2">
            {reported.map((p) => {
              const author = getUser(p.authorId);
              return (
                <li
                  key={p.id}
                  className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3"
                >
                  <div className="text-xs text-[var(--muted)] flex justify-between mb-1">
                    <span>
                      {space.name} <span className="opacity-60">/ {p.threadId}</span>
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
            {sunk.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 opacity-80"
              >
                <div className="text-xs text-[var(--muted)] flex justify-between mb-1">
                  <span>
                    {space.name} <span className="opacity-60">/ {p.threadId}</span>
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
            ))}
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
              return (
                <li
                  key={m.id}
                  className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 text-sm"
                >
                  <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                    <span>
                      {space.name} <span className="opacity-60">/ {m.kind}</span>
                    </span>
                    <span>{fmt(m.at)}</span>
                  </div>
                  <div className="text-xs text-[var(--muted)]">by {m.byUserId}</div>
                  {post && (
                    <p className="mt-1 text-[var(--muted)] truncate">
                      {post.body.slice(0, 80)}
                      {post.body.length > 80 && "..."}
                    </p>
                  )}
                  {m.note && (
                    <p className="mt-1 text-xs text-[var(--warn)]">{m.note}</p>
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
