import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">そのページは見つかりませんでした</h1>
      <p className="text-sm text-[var(--muted)]">
        URL を確認するか、場の一覧から探し直してください。
      </p>
      <Link
        href="/"
        className="inline-block px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium"
      >
        場の一覧へ
      </Link>
    </div>
  );
}
