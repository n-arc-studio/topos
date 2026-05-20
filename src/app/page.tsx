import Link from "next/link";
import { listSpaces, listThreads } from "@/lib/infra/store";

export default function Home() {
  const spaces = listSpaces();
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">場の一覧</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          場は「文脈の宇宙」。それぞれの場には憲章と管理者がいる。
        </p>
      </section>
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
