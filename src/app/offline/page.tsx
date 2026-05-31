import Link from "next/link";

export const metadata = {
  title: "オフライン — Topos",
};

// Service Worker がネットワーク失敗時に表示するフォールバック。
export default function OfflinePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">オフラインです</h1>
      <p className="text-sm text-[var(--muted)]">
        ネットワークに接続できませんでした。接続が戻ったら、もう一度開いてください。
        すでに開いたことのあるページはキャッシュから表示されることがあります。
      </p>
      <Link
        href="/"
        className="inline-block px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium"
      >
        ホームを再読み込み
      </Link>
    </div>
  );
}
