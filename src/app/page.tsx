import Link from "next/link";
import {
  listHotThreads,
  listSpaces,
  listThreads,
} from "@/lib/infra/store";

export default function Home() {
  const spaces = listSpaces();
  const hot = listHotThreads(5);
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">場の一覧</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          場は「文脈の宇宙」。それぞれの場には憲章と管理者がいる。
        </p>
      </section>

      {hot.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="text-sm font-medium text-[var(--muted)] mb-3">
            いま動きのある話題
          </h2>
          <ul className="space-y-2">
            {hot.map((h) => (
              <li key={h.thread.id}>
                <Link
                  href={`/spaces/${h.space.id}/threads/${h.thread.id}`}
                  className="flex items-baseline justify-between gap-3 text-sm hover:text-[var(--accent)] transition"
                >
                  <span className="truncate">
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
      <ul className="space-y-3">
        {spaces.map((s) => {
          const threads = listThreads(s.id);
          return (
            <li
              key={s.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 hover:bg-[var(--panel-2)] transition"
            >
              <Link href={`/spaces/${s.id}`} className="block">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-medium">{s.name}</h2>
                  <span className="text-xs text-[var(--muted)]">
                    {threads.length} スレ
                  </span>
                </div>
                <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
                  {s.charter}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
