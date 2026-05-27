"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReplyComposer({
  threadId,
  replyTo,
  canBeAnonymous,
  onDone,
}: {
  threadId: string;
  replyTo: string;
  canBeAnonymous: boolean;
  onDone?: () => void;
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
            body: JSON.stringify({
              threadId,
              body,
              identityMode: mode,
              replyTo,
            }),
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
          onDone?.();
          router.refresh();
        });
      }}
      className="space-y-2 mt-2"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="返信を書く (突っ込み歓迎)"
        rows={2}
        className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-y"
      />
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
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
                  name={`mode-${replyTo}`}
                  className="hidden"
                  checked={mode === "anonymous"}
                  onChange={() => setMode("anonymous")}
                />
                匿名
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
                  name={`mode-${replyTo}`}
                  className="hidden"
                  checked={mode === "named"}
                  onChange={() => setMode("named")}
                />
                記名
              </label>
            </>
          )}
          {!canBeAnonymous && (
            <span className="text-[var(--muted)]">管理者は記名のみ</span>
          )}
          {err && <span className="text-[var(--warn)]">{err}</span>}
        </div>
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="px-3 py-1.5 rounded bg-[var(--accent)] text-white font-medium disabled:opacity-50"
        >
          返信
        </button>
      </div>
    </form>
  );
}
