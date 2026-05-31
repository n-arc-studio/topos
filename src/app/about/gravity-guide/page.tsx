import Link from "next/link";

export const metadata = {
  title: "重力歪みの見方ガイド - Topos",
  description:
    "スレッド内で表示される重力歪みの意味、目安、増減要因をまとめたガイドページ。",
};

export default function GravityGuidePage() {
  return (
    <article className="space-y-8 max-w-3xl">
      <header className="space-y-3">
        <p className="text-xs tracking-[0.18em] uppercase text-[var(--muted)]">
          Reading Guide
        </p>
        <h1 className="text-2xl font-semibold">重力歪みの見方ガイド</h1>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          スレッド上部に出る「あなたの重力歪み」は、あなたの投稿がそのスレッド全体の
          重力のうちどれだけを占めているかを見るための指標です。数値は勝ち負けではなく、
          今の場に対する影響度を読むための手がかりとして扱います。
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold">定義</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          歪み率 = このスレッド全体の重力のうち、あなたの投稿が占める割合
        </p>
        <div className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--muted)]">
          <p>
            歪み率が上がるほど、あなたの投稿がそのスレッドの流れに強く効いています。
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold">目安</h2>
        <ul className="space-y-1 text-sm text-[var(--muted)] list-disc list-inside">
          <li>0-10%: 影響小</li>
          <li>10-30%: 存在感あり</li>
          <li>30%以上: 流れを主導</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold">増減要因</h2>
        <div className="grid gap-3 md:grid-cols-2 text-sm text-[var(--muted)]">
          <div className="rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 space-y-2">
            <p className="font-medium text-[var(--foreground)]">増える</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>反応がつく</li>
              <li>返信が連なる</li>
              <li>参加者が広がる</li>
            </ul>
          </div>
          <div className="rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 space-y-2">
            <p className="font-medium text-[var(--foreground)]">下がる</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>時間経過</li>
              <li>通報</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold">見方のコツ</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          数値が高いこと自体を目標にするより、「なぜその数字になっているか」を見るのが
          役目です。反応の増加、返信の連鎖、参加者の広がりがあるなら、場に働きかける
          何かが起きています。逆に、時間経過や通報で落ちているなら、投稿の出し方や
          タイミングを見直す手がかりになります。
        </p>
      </section>

      <footer className="flex flex-wrap gap-3 text-sm">
        <Link href="/about" className="text-[var(--accent)] hover:underline">
          ← Topos とは
        </Link>
        <Link href="/" className="text-[var(--muted)] hover:text-[var(--accent)]">
          トップに戻る
        </Link>
      </footer>
    </article>
  );
}