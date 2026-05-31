import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { getSpace, listThreads, getUser } from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";
import { NewThreadForm } from "@/components/NewThreadForm";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const space = getSpace(spaceId);
  if (!space) notFound();

  const me = await currentUser();
  const threads = listThreads(space.id);
  const admins = space.adminIds
    .map((id) => getUser(id))
    .filter((u): u is NonNullable<typeof u> => !!u);

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-baseline justify-between">
          <Link href="/" className="text-xs text-[var(--muted)] hover:underline">
            ← 場の一覧
          </Link>
        </div>
        <h1 className="text-2xl font-semibold mt-2">{space.name}</h1>
        <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
          {space.charter}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
          時空管理者:{" "}
          {admins.map((a) => (
            <span key={a.id} className="text-[var(--accent)] mr-2">
              {a.displayName} (Mass {a.publicMass})
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        <h2 className="text-sm font-medium mb-2">新しいスレッドを建てる</h2>
        {me ? (
          <NewThreadForm spaceId={space.id} />
        ) : (
          <AuthGate message="スレッド作成にはログインが必要です。" />
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">スレッド</h2>
        {threads.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            まだスレッドはありません。
            <br />
            最初の問いを置いてみませんか?
          </div>
        ) : (
          <ul className="space-y-2">
            {threads.map((t) => (
              <li
                key={t.id}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-2)] transition"
              >
                <Link
                  href={`/spaces/${space.id}/threads/${t.id}`}
                  className="block p-3"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                    <span className="font-medium break-words">{t.title}</span>
                    <span className="text-xs text-[var(--muted)] sm:text-right">
                      {new Date(t.createdAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-[var(--muted)]">
        あなた: {me?.displayName ?? "未ログイン"}
      </p>
    </div>
  );
}
