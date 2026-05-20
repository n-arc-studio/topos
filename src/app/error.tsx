"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[topos] runtime error", error);
  }, [error]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">エラーが発生しました</h1>
      <p className="text-sm text-[var(--muted)]">
        ページを開けませんでした。少し時間をおいて再試行してください。
      </p>
      {error.digest && (
        <p className="text-xs text-[var(--muted)]">
          参照ID:{" "}
          <code className="text-[var(--foreground)]">{error.digest}</code>
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium"
        >
          再試行
        </button>
        <a
          href="/"
          className="px-3 py-2 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
        >
          ホームへ戻る
        </a>
      </div>
    </div>
  );
}
