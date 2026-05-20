import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSpace,
  getThread,
  getUser,
  isAdmin,
  listPosts,
} from "@/lib/infra/store";
import { gravityScore, sedimentLevel } from "@/lib/domain/gravity";
import { currentUser } from "@/lib/session/identity";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ spaceId: string; threadId: string }>;
}) {
  const { spaceId, threadId } = await params;
  const space = getSpace(spaceId);
  const thread = getThread(threadId);
  if (!space || !thread || thread.spaceId !== space.id) notFound();

  const me = await currentUser();
  const meIsAdmin = isAdmin(me.id, space.id);

  const now = Date.now();
  const posts = listPosts(thread.id)
    .map((p) => ({
      post: p,
      g: gravityScore(p, now),
      s: sedimentLevel(p, now),
    }))
    // 重力スコア降順 (浮力の強い順)
    .sort((a, b) => b.g - a.g);

  return (
    <div className="space-y-6">
      <section>
        <Link
          href={`/spaces/${space.id}`}
          className="text-xs text-[var(--muted)] hover:underline"
        >
          ← {space.name}
        </Link>
        <h1 className="text-xl font-semibold mt-2">{thread.title}</h1>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        <PostComposer threadId={thread.id} canBeAnonymous={!meIsAdmin} />
        {meIsAdmin && (
          <p className="text-xs text-[var(--warn)] mt-2">
            あなたはこの場の管理者です。記名投稿のみ可能です(責任の可視化のため)。
          </p>
        )}
      </section>

      <section className="space-y-3">
        {posts.length === 0 && (
          <p className="text-sm text-[var(--muted)]">まだ発言がありません。</p>
        )}
        {posts.map(({ post, g, s }) => {
          const author = getUser(post.authorId);
          const displayName =
            post.identityMode === "named" && author
              ? author.displayName
              : "名無しの旅人";
          return (
            <PostCard
              key={post.id}
              post={post}
              displayName={displayName}
              gravity={g}
              sediment={s}
            />
          );
        })}
      </section>
    </div>
  );
}
