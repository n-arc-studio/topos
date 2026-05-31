"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MAX_BODY_LENGTH = 2000;

const REPLY_TEMPLATES = [
  "同意: この視点は有効だと思います。",
  "質問: ここはどう定義していますか?",
  "反証: この条件だと別の結果になりませんか?",
  "提案: 次の一手としてこれを試したいです。",
] as const;

function replyDraftKey(threadId: string, replyTo: string): string {
  return `topos:draft:reply:${threadId}:${replyTo}`;
}

function mapReplyError(code: string | undefined): string {
  switch (code) {
    case "empty_body":
      return "返信内容を入力してください。";
    case "too_long":
      return `返信は${MAX_BODY_LENGTH}文字以内で入力してください。`;
    case "reply_target_not_found":
      return "返信先の投稿が見つかりません。ページを再読み込みしてください。";
    case "thread_not_found":
      return "スレッドが見つかりません。ページを再読み込みしてください。";
    case "space_archived":
      return "この場は現在書き込みできません。";
    case "invalid_input":
      return "入力内容を確認してください。";
    default:
      return "返信に失敗しました。時間をおいて再試行してください。";
  }
}

export function ReplyComposer({
  threadId,
  replyTo,
  replyToDisplayName,
  replyToPreview,
  canBeAnonymous,
  autoFocus = false,
  onDone,
}: {
  threadId: string;
  replyTo: string;
  replyToDisplayName?: string;
  replyToPreview?: string;
  canBeAnonymous: boolean;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"named" | "anonymous">(
    canBeAnonymous ? "anonymous" : "named"
  );
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overLimit = body.length > MAX_BODY_LENGTH;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(replyDraftKey(threadId, replyTo));
      if (saved && saved.trim().length > 0) {
        setBody(saved);
        setRestored(true);
      }
    } catch {
      // no-op
    }
  }, [threadId, replyTo]);

  useEffect(() => {
    try {
      if (!body.trim()) {
        window.localStorage.removeItem(replyDraftKey(threadId, replyTo));
        return;
      }
      window.localStorage.setItem(replyDraftKey(threadId, replyTo), body);
    } catch {
      // no-op
    }
  }, [body, threadId, replyTo]);

  useEffect(() => {
    if (!autoFocus) return;
    textareaRef.current?.focus();
  }, [autoFocus]);

  function applyTemplate(template: string) {
    setBody((prev) => (prev.trim() ? `${prev}\n\n${template}` : template));
  }

  const preview = replyToPreview?.slice(0, 120);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const trimmed = body.trim();
          if (!trimmed) {
            setErr("返信内容を入力してください。");
            return;
          }
          if (body.length > MAX_BODY_LENGTH) {
            setErr(`返信は${MAX_BODY_LENGTH}文字以内で入力してください。`);
            return;
          }

          const res = await fetch("/api/posts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              threadId,
              body: trimmed,
              identityMode: mode,
              replyTo,
            }),
          });
          const json = await res.json();
          if (!res.ok) {
            if (res.status === 401) {
              try {
                window.localStorage.setItem(replyDraftKey(threadId, replyTo), body);
              } catch {
                // no-op
              }
              router.push(
                `/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`
              );
              return;
            }
            setErr(mapReplyError(json.error));
            return;
          }
          setBody("");
          try {
            window.localStorage.removeItem(replyDraftKey(threadId, replyTo));
          } catch {
            // no-op
          }
          router.refresh();
          onDone?.();
        });
      }}
      className="mt-2 space-y-3"
    >
      {preview && (
        <div className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--muted)]">
          <p className="font-medium text-[var(--foreground)]">
            返信先 {replyToDisplayName ? `(${replyToDisplayName})` : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{preview}</p>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="返信を書く (突っ込み歓迎)"
        rows={3}
        className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2.5 text-[15px] leading-[1.8] outline-none focus:border-[var(--accent)] resize-y"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {REPLY_TEMPLATES.map((template) => (
          <button
            key={template}
            type="button"
            onClick={() => applyTemplate(template)}
            className="px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
          >
            {template.split(":")[0]}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--muted)]">会話を一歩前に進める返信を歓迎します。</span>
        <span className={overLimit ? "text-[var(--warn)]" : "text-[var(--muted)]"}>
          {body.length}/{MAX_BODY_LENGTH}
        </span>
      </div>
      {restored && (
        <p className="text-xs text-[var(--muted)]">返信の下書きを復元しました。</p>
      )}
      <div className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
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
          disabled={pending || !body.trim() || overLimit}
          className="w-full px-3 py-1.5 rounded bg-[var(--accent)] text-white font-medium disabled:opacity-50 sm:w-auto"
        >
          返信
        </button>
      </div>
    </form>
  );
}
