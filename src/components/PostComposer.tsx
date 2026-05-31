"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MAX_BODY_LENGTH = 2000;

const POST_TEMPLATES = [
  "問い: いま詰まっている点はどこですか?",
  "要約: ここまでの議論を3行でまとめると...",
  "反証: この前提だと別ケースで破綻しませんか?",
  "改善提案: 次に試すならこの手順が良さそうです",
] as const;

function draftKey(threadId: string): string {
  return `topos:draft:post:${threadId}`;
}

function mapPostError(code: string | undefined): string {
  switch (code) {
    case "empty_body":
      return "本文を入力してください。";
    case "too_long":
      return `本文は${MAX_BODY_LENGTH}文字以内で入力してください。`;
    case "thread_not_found":
      return "スレッドが見つかりません。ページを再読み込みしてください。";
    case "space_archived":
      return "この場は現在書き込みできません。";
    case "invalid_input":
      return "入力内容を確認してください。";
    default:
      return "投稿に失敗しました。時間をおいて再試行してください。";
  }
}

export function PostComposer({
  threadId,
  canBeAnonymous,
  todayCount,
}: {
  threadId: string;
  canBeAnonymous: boolean;
  todayCount?: number;
}) {
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"named" | "anonymous">(
    canBeAnonymous ? "anonymous" : "named"
  );
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const router = useRouter();
  const overLimit = body.length > MAX_BODY_LENGTH;
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isKeyboardOpen = keyboardInset > 80;

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(320, Math.max(120, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(threadId));
      if (saved && saved.trim().length > 0) {
        setBody(saved);
        setRestored(true);
      }
    } catch {
      // no-op: localStorage が使えない環境では下書き保存を無効化する。
    }
  }, [threadId]);

  useEffect(() => {
    try {
      if (!body.trim()) {
        window.localStorage.removeItem(draftKey(threadId));
        return;
      }
      window.localStorage.setItem(draftKey(threadId), body);
    } catch {
      // no-op
    }
  }, [body, threadId]);

  useEffect(() => {
    resizeTextarea();
  }, [body]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  function applyTemplate(template: string) {
    setBody((prev) => (prev.trim() ? `${prev}\n\n${template}` : template));
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const trimmed = body.trim();
          if (!trimmed) {
            setErr("本文を入力してください。");
            return;
          }
          if (body.length > MAX_BODY_LENGTH) {
            setErr(`本文は${MAX_BODY_LENGTH}文字以内で入力してください。`);
            return;
          }

          const res = await fetch("/api/posts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ threadId, body: trimmed, identityMode: mode }),
          });
          const json = await res.json();
          if (!res.ok) {
            if (res.status === 401) {
              try {
                window.localStorage.setItem(draftKey(threadId), body);
              } catch {
                // no-op
              }
              router.push(
                `/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`
              );
              return;
            }
            setErr(mapPostError(json.error));
            return;
          }
          setBody("");
          try {
            window.localStorage.removeItem(draftKey(threadId));
          } catch {
            // no-op
          }
          const restoreY = window.scrollY;
          router.refresh();
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: restoreY });
          });
        });
      }}
      className="space-y-3"
    >
      {typeof todayCount === "number" && (
        <div className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs space-y-1">
          <p className="text-[var(--foreground)] font-medium">今日の書き込み: {todayCount}件</p>
          <p className="text-[var(--muted)]">量より、会話を一歩前に進める一言を重視します。</p>
        </div>
      )}
      <textarea
        id="thread-post-composer"
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        placeholder="内容を投稿する。必要なら提案や修正依頼として書く。"
        rows={4}
        enterKeyHint="send"
        className="w-full overflow-hidden bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2.5 text-[15px] leading-[1.8] outline-none focus:border-[var(--accent)] resize-none"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {POST_TEMPLATES.map((template) => (
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-[var(--muted)]">
          匿名は役割を軽く、記名は責任を明示して投稿できます。
        </p>
        <span className={overLimit ? "text-[var(--warn)]" : "text-[var(--muted)]"}>
          {body.length}/{MAX_BODY_LENGTH}
        </span>
      </div>
      {restored && (
        <p className="text-xs text-[var(--muted)]">下書きを復元しました。</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
                  name="mode"
                  className="hidden"
                  checked={mode === "named"}
                  onChange={() => setMode("named")}
                />
                記名
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
          disabled={pending || !body.trim() || overLimit}
          className="w-full px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50 sm:w-auto"
        >
          投下する
        </button>
      </div>
      {isKeyboardOpen && (
        <div
          className="fixed inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--panel-2)]/95 px-3 py-2 backdrop-blur sm:hidden"
          style={{ bottom: `calc(env(safe-area-inset-bottom) + ${keyboardInset}px)` }}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-xs text-[var(--muted)]">
              {body.length}/{MAX_BODY_LENGTH}
            </span>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              disabled={pending || !body.trim() || overLimit}
              className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              投下する
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
