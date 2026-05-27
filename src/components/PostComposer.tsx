"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PostComposer({
  threadId,
  canBeAnonymous,
}: {
  threadId: string;
  canBeAnonymous: boolean;
}) {
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"named" | "anonymous">(
    canBeAnonymous ? "anonymous" : "named"
  );
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const res = await fetch("/api/posts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ threadId, body, identityMode: mode }),
          });
          const json = await res.json();
          if (!res.ok) {
            if (res.status === 401) {
              router.push(
                `/login?next=${encodeURIComponent(window.location.pathname)}`
              );
              return;
            }
            setErr(json.error ?? "失敗");
            return;
          }
          setBody("");
          router.refresh();
        });
      }}
      className="space-y-2"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="内容を投稿する。必要なら提案や修正依頼として書く。"
        rows={3}
        className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-y"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {canBeAnonymous && (
            <>
              <label
                className={`px-2 py-1 rounded border cursor-pointer ${
                  mode === "anonymous"
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  className="hidden"
                  checked={mode === "anonymous"}
                  onChange={() => setMode("anonymous")}
                />
                匿名 (真空・Sink)
              </label>
              <label
                className={`px-2 py-1 rounded border cursor-pointer ${
                  mode === "named"
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  className="hidden"
                  checked={mode === "named"}
                  onChange={() => setMode("named")}
                />
                記名 (源泉・Source)
              </label>
            </>
          )}
          {!canBeAnonymous && (
            <span className="text-[var(--muted)]">管理者投稿 (記名固定)</span>
          )}
          {err && <span className="text-[var(--warn)]">{err}</span>}
        </div>
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50"
        >
          投下する
        </button>
      </div>
    </form>
  );
}
