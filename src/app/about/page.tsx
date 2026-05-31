import Link from "next/link";

export const metadata = {
  title: "Topos とは — 思想と読み方",
  description:
    "Topos の重力・沈殿層・質量という3つの概念と、現段階の仕様・運用方針をまとめたページ。",
};

export default function AboutPage() {
  return (
    <article className="prose prose-invert max-w-none space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">
          <span className="text-[var(--accent)]">●</span> Topos とは
        </h1>
        <p className="text-[var(--muted)] leading-relaxed">
          Topos は「フォロワー数」でも「いいね数」でもなく、
          <strong className="text-[var(--foreground)]">場への寄与</strong>
          で評価される実験的 SNS です。発言は時間とともに沈み、
          関心が集まる発言だけが水面に残り、忘れられた発言は深層に堆積します。
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3つの基本概念</h2>

        <div className="rounded border border-[var(--border)] p-4 space-y-2">
          <h3 className="font-semibold text-[var(--accent)]">① 重力 (Gravity)</h3>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            投稿が「場に留まる力」。返信・参加者・リアクションで上がり、
            時間経過・通報・スレッドの沈降で下がります。
            <span className="text-[var(--foreground)]">
              重力が高い = 浮く（上に表示される）。低い = 沈む。
            </span>
            メタファーは逆向きですが「水面に近いほど目に触れる」と覚えてください。
          </p>
        </div>

        <div className="rounded border border-[var(--border)] p-4 space-y-2">
          <h3 className="font-semibold text-[var(--accent)]">② 沈殿層 (Sediment)</h3>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            重力スコアに応じて投稿が 4 層に分類されます。
            スレッド画面の「沈殿層」リンクから層別ビューに切り替えられます。
          </p>
          <ul className="text-sm space-y-1 mt-2">
            <li>
              <strong className="text-[var(--foreground)]">表層</strong>
              <span className="text-[var(--muted)]"> (≥ 0.80) — いま読まれている</span>
            </li>
            <li>
              <strong className="text-[var(--foreground)]">中層</strong>
              <span className="text-[var(--muted)]"> (≥ 0.55) — 沈み始め</span>
            </li>
            <li>
              <strong className="text-[var(--foreground)]">深層</strong>
              <span className="text-[var(--muted)]"> (≥ 0.25) — 古い・反応が薄い</span>
            </li>
            <li>
              <strong className="text-[var(--foreground)]">最深層</strong>
              <span className="text-[var(--muted)]"> (&lt; 0.25) — 忘却間近</span>
            </li>
          </ul>
        </div>

        <div className="rounded border border-[var(--border)] p-4 space-y-2">
          <h3 className="font-semibold text-[var(--accent)]">③ 質量 (Mass)</h3>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            ユーザーが「場に貢献した蓄積」。
            <strong className="text-[var(--foreground)]">記名 (公) と匿名 (匿) で別々に積まれます。</strong>
            質量を持つユーザーが投稿すると、初動の重力に
            <code className="bg-[var(--panel)] px-1 rounded">log10(1 + mass)</code>{" "}
            のボーナスが乗ります。記名と匿名を分けることで「人格の使い分け」を
            許容しつつ、なりすましのコストを上げています。
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">現段階の仕様 (2026-05)</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          現在は「比較で煽る」よりも「文脈に貢献する次の一手」を優先する段階です。
          数値は競争のためではなく、場の状態を読むための補助として扱います。
        </p>
        <ul className="text-sm text-[var(--muted)] space-y-2 list-disc list-inside leading-relaxed">
          <li>
            スレッド上部に「あなたの重力歪み」を表示し、
            自分の投稿がそのスレッド全体にどれだけ影響しているかを可視化します。
          </li>
          <li>
            「質量ランキング」は常時表示せず、折りたたみで任意に確認する設計です。
            前面化して競争を強めすぎないための措置です。
          </li>
          <li>
            投稿フォームには、今日の書き込み件数を表示します。
            量の競争ではなく、場への関わり方を自分で観測するための補助です。
          </li>
          <li>
            仕様は観測しながら段階調整します。投稿品質の低下や連投偏重が見えた場合は、
            すぐに表示強度や文言を引き下げます。
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">重力グラフの読み方</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          投稿カードの「重力 X.X」をクリックすると、その投稿の重力推移を
          折線グラフで確認できます。緑の線が重力スコア、オレンジの点線が現在時刻です。
        </p>

        <div className="grid gap-3 mt-4">
          <Pattern
            icon="🟢"
            title="緩やかな減衰型（多くの場で理想）"
            shape="●━━━╲___"
            desc="初動が静かで、半減期分かけてゆっくり沈む。読まれて、納得されて、過剰に騒がれず流れていく形。思索系の場で最善。"
          />
          <Pattern
            icon="🔥"
            title="スパイク型（バズ／炎上）"
            shape="●━╱╲___"
            desc="急上昇してすぐ枯れる。時事・告知系ならアリ。ただし通報ペナルティが効くと急落する。沈殿層に残らないため Topos では「消費される」だけの形。"
          />
          <Pattern
            icon="🌱"
            title="二段燃焼型（再発見）"
            shape="●━╲___╱━╲___"
            desc="一度沈みかけた投稿が、引用や返信で再上昇。ナレッジ蓄積系の場で理想形。これが頻発する場は『沈殿層 = 図書館』として機能している。"
          />
          <Pattern
            icon="⚫"
            title="即時最深層（避けたい）"
            shape="●━╲___ (abyss)"
            desc="反応ゼロで半減期1サイクル以内に最深層へ。続くと『投稿しても誰にも届かない』体験になる。タイトル・記名・場の選び直しで脱出可。"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">ユーザーが目指すべきこと</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Topos の思想は{" "}
          <strong className="text-[var(--foreground)]">
            「スパイク型より、緩やかな減衰 + 再発見」
          </strong>
          を促すことです。スパイクは「いま消費される」だけで沈殿層に残らず、
          緩やかな減衰は「読まれる時間が長い」ことを意味し、
          再発見曲線は「忘れられても掘り起こされる価値がある」ことの証明だからです。
        </p>
        <table className="w-full text-sm border border-[var(--border)] mt-3">
          <thead className="bg-[var(--panel)]">
            <tr>
              <th className="text-left p-2 border-b border-[var(--border)]">目的</th>
              <th className="text-left p-2 border-b border-[var(--border)]">アクション</th>
            </tr>
          </thead>
          <tbody className="text-[var(--muted)]">
            <tr className="border-b border-[var(--border)]">
              <td className="p-2">緩やかな減衰を作る</td>
              <td className="p-2">場の主題に沿った内容・記名投稿で質量を活かす・短すぎず長すぎない一文目</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="p-2">再発見を誘発する</td>
              <td className="p-2">古い投稿に引用返信を残す・関連スレッドから橋を架ける</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="p-2">炎上を避ける</td>
              <td className="p-2">通報を呼ぶ刺激的表現を控える（reportPenalty で急落する）</td>
            </tr>
            <tr>
              <td className="p-2">最深層を脱出する</td>
              <td className="p-2">別の場へ移す・タイトルや一文目を変える・記名で投稿し直す</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">場の管理者へ</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          管理者向けコンソールから、場ごとに重力係数を上書きできます。
          「どの曲線を歓迎するか」を設計するのは管理者の役目です。
        </p>
        <ul className="text-sm text-[var(--muted)] space-y-1 list-disc list-inside">
          <li>
            <strong className="text-[var(--foreground)]">思索の場</strong> —{" "}
            <code className="bg-[var(--panel)] px-1 rounded">halfLifeHours: 72</code>（3日）・
            <code className="bg-[var(--panel)] px-1 rounded">reportPenalty: 0.8</code>（強め）
          </li>
          <li>
            <strong className="text-[var(--foreground)]">時事の場</strong> —{" "}
            <code className="bg-[var(--panel)] px-1 rounded">halfLifeHours: 6</code>・
            <code className="bg-[var(--panel)] px-1 rounded">replyWeight: 0.3</code>（議論を歓迎）
          </li>
          <li>
            <strong className="text-[var(--foreground)]">アーカイブ寄りの場</strong> —{" "}
            <code className="bg-[var(--panel)] px-1 rounded">halfLifeHours: 168</code>（1週間）・
            <code className="bg-[var(--panel)] px-1 rounded">sunkDamp: 0.3</code>（沈降後も残す）
          </li>
        </ul>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          重力グラフは「目標」ではなく「
          <strong className="text-[var(--foreground)]">鏡</strong>
          」として機能するのが理想です。場の文化が曲線の形に現れ、
          管理者はそれを見て係数を調整します。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">実験段階について</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Topos は実験段階のサービスです。スレッドに書き込まれた情報の永続保証はしません。
          仕様や使い方は、ユーザーの意見をもとにこれからも変えていきます。
          気づいたことや改善案があれば、どんどん意見をください。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">MVP の注意事項</h2>
        <ul className="text-sm text-[var(--muted)] space-y-2 list-disc list-inside leading-relaxed">
          <li>
            投稿・スレッド・設定は、実験運用の都合で今後消える、移行される、または仕様変更されることがあります。
          </li>
          <li>
            「場」「重力」「沈殿層」のふるまいは調整対象です。使い方や見え方が予告なく変わることがあります。
          </li>
          <li>
            認証は Credentials ベースのログイン方式です。管理者権限は場ごとのロールで付与され、
            全体管理者と場管理者は権限を分離して運用しています。
          </li>
          <li>
            通報・沈降・管理者操作は試験運用です。最終仕様ではないため、挙動や条件が変わる可能性があります。
          </li>
          <li>
            使いにくい点や違和感は、ぜひ意見としてください。ユーザーの声をもとに、機能や文言を更新していきます。
          </li>
          <li>
            商用利用や業務組み込みは現時点では想定していません。利用条件が変わる場合は、別途案内します。
          </li>
        </ul>
      </section>

      <footer className="pt-6 border-t border-[var(--border)] text-xs text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--accent)]">
          ← トップに戻る
        </Link>
      </footer>
    </article>
  );
}

function Pattern({
  icon,
  title,
  shape,
  desc,
}: {
  icon: string;
  title: string;
  shape: string;
  desc: string;
}) {
  return (
    <div className="rounded border border-[var(--border)] p-3 flex gap-3">
      <div className="text-2xl shrink-0">{icon}</div>
      <div className="space-y-1">
        <div className="font-semibold text-sm">{title}</div>
        <pre className="text-xs text-[var(--accent)] font-mono whitespace-pre">
          {shape}
        </pre>
        <p className="text-xs text-[var(--muted)] leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
