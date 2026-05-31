"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const THREAD_TITLE_TEMPLATES = [
  "問い:",
  "検証:",
  "提案:",
  "要約:",
] as const;

const TITLE_SOFT_LIMIT = 80;

function threadDraftKey(spaceId: string): string {
  return `topos:draft:thread:${spaceId}`;
}

function mapThreadError(code: string | undefined): string {
  switch (code) {
    case "empty_title":
      return "タイトルを入力してください。";
    case "space_archived":
      return "この場は現在スレッドを建てられません。";
    case "space_not_found":
      return "場が見つかりません。ページを再読み込みしてください。";
    case "invalid_input":
      return "入力内容を確認してください。";
    default:
      return "スレッド作成に失敗しました。時間をおいて再試行してください。";
  }
}

export function NewThreadForm({ spaceId }: { spaceId: string }) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(threadDraftKey(spaceId));
      if (saved && saved.trim().length > 0) {
        setTitle(saved);
        setRestored(true);
      }
    } catch {
      // no-op
    }
  }, [spaceId]);

  useEffect(() => {
    try {
      if (!title.trim()) {
        window.localStorage.removeItem(threadDraftKey(spaceId));
        return;
      }
      window.localStorage.setItem(threadDraftKey(spaceId), title);
    } catch {
      // no-op
    }
  }, [title, spaceId]);

  function applyTemplate(prefix: string) {
    setTitle((prev) => {
      if (!prev.trim()) return `${prefix} `;
      if (prev.startsWith(prefix)) return prev;
      return `${prefix} ${prev}`;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const trimmed = title.trim();
          if (!trimmed) {
            setErr("タイトルを入力してください。");
            return;
          }

          const res = await fetch("/api/threads", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ spaceId, title: trimmed }),
          });
          const json = await res.json();
          if (!res.ok) {
            if (res.status === 401) {
              try {
                window.localStorage.setItem(threadDraftKey(spaceId), title);
              } catch {
                // no-op
              }
              router.push(`/login?next=${encodeURIComponent(`/spaces/${spaceId}`)}`);
              return;
            }
            setErr(mapThreadError(json.error));
            return;
          }
          setTitle("");
          try {
            window.localStorage.removeItem(threadDraftKey(spaceId));
          } catch {
            // no-op
          }
          router.refresh();
          router.push(`/spaces/${spaceId}/threads/${json.id}`);
        });
      }}
      className="space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {THREAD_TITLE_TEMPLATES.map((prefix) => (
          <button
            key={prefix}
            type="button"
            onClick={() => applyTemplate(prefix)}
            className="px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
          >
            {prefix.replace(":", "")}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="スレッドのタイトル (この場の文脈に沿ったテーマ)"
        className="flex-1 bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="w-full px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50 sm:w-auto"
      >
        建てる
      </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[var(--muted)]">
          迷ったら「問い:」で始めると参加されやすくなります。
        </span>
        <span className={title.length > TITLE_SOFT_LIMIT ? "text-[var(--warn)]" : "text-[var(--muted)]"}>
          {title.length}文字
        </span>
      </div>
      {restored && (
        <p className="text-xs text-[var(--muted)]">スレッド下書きを復元しました。</p>
      )}
      {err && <span className="text-xs text-[var(--warn)]">{err}</span>}
    </form>
  );
}
