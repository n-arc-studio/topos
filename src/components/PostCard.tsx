"use client";

import { useEffect, useState, useTransition } from "react";
import type { Post, ReactionKind, GravityEvent } from "@/lib/domain/types";
import { REACTION_LABEL } from "@/lib/domain/types";
import { AdminDeleteButton } from "./AdminDeleteButton";
import { ReplyComposer } from "./ReplyComposer";
import { GravityChart } from "./GravityChart";

const REACTION_ORDER: ReactionKind[] = [
  "like",
  "agree",
  "useful",
  "laugh",
  "tsukkomi",
  "heavy",
];

const PRIMARY_REACTION_ORDER: ReactionKind[] = ["like", "useful"];

const REACTION_ICON: Record<ReactionKind, string> = {
  like: "👍",
  agree: "🤝",
  useful: "💡",
  laugh: "😄",
  tsukkomi: "💬",
  heavy: "🪨",
};

const MAX_BODY_LENGTH = 2000;

function formatLagJP(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "直後";
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms < minute) return "1分未満後";
  if (ms < hour) return `${Math.floor(ms / minute)}分後`;
  if (ms < day) return `${Math.floor(ms / hour)}時間後`;
  return `${Math.floor(ms / day)}日後`;
}

export function PostCard({
  post,
  displayName,
  gravity,
  sediment,
  replyCount,
  participants,
  meIsAdmin,
  meIsAnonymous,
  canDelete,
  canEdit,
  editDisabledReason,
  threadId,
  depth = 0,
  halfLifeHours,
  events,
  isMyPost = false,
  distortionLevel = 0,
  replyContext,
}: {
  post: Post;
  displayName: string;
  gravity: number;
  sediment: number;
  replyCount: number;
  participants: number;
  meIsAdmin: boolean;
  meIsAnonymous: boolean;
  canDelete: boolean;
  canEdit: boolean;
  editDisabledReason?: string;
  threadId: string;
  depth?: number;
  halfLifeHours?: number;
  events?: GravityEvent[];
  isMyPost?: boolean;
  distortionLevel?: number;
  replyContext?: {
    postId: string;
    displayName: string;
    body: string;
    createdAt: number;
    lagMs: number;
  };
}) {
  const [, start] = useTransition();
  const [pendingReaction, setPendingReaction] = useState<ReactionKind | null>(null);
  const [pendingReport, setPendingReport] = useState(false);
  const [pendingModeration, setPendingModeration] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(false);
  const [reactions, setReactions] = useState(post.reactions);
  const [reportCount, setReportCount] = useState(post.reportCount);
  const [isPinned, setIsPinned] = useState(post.isPinned);
  const [isSunk, setIsSunk] = useState(post.isSunk);
  const [bodyText, setBodyText] = useState(post.body);
  const [editedAt, setEditedAt] = useState(post.editedAt);
  const [err, setErr] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [autoFocusReply, setAutoFocusReply] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(post.body);
  const [chartOpen, setChartOpen] = useState(false);

  function react(kind: ReactionKind) {
    if (pendingReaction) return;
    setErr(null);
    setPendingReaction(kind);
    setReactions((prev) => ({
      ...prev,
      [kind]: (prev[kind] ?? 0) + 1,
    }));
    start(async () => {
      try {
        const res = await fetch(`/api/posts/${post.id}/reactions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind }),
        });
        const json = await res.json();
        if (!res.ok) {
          // 楽観更新を巻き戻す。
          setReactions((prev) => ({
            ...prev,
            [kind]: Math.max(0, (prev[kind] ?? 1) - 1),
          }));
          setErr(json.error ?? "失敗");
          return;
        }
        if (json.reactions) {
          setReactions(json.reactions);
        }
      } catch {
        setReactions((prev) => ({
          ...prev,
          [kind]: Math.max(0, (prev[kind] ?? 1) - 1),
        }));
        setErr("通信に失敗しました");
      } finally {
        setPendingReaction(null);
      }
    });
  }

  function report() {
    if (!confirm("この投稿を通報しますか?")) return;
    if (pendingReport) return;
    setErr(null);
    const prevReportCount = reportCount;
    const prevIsSunk = isSunk;
    setPendingReport(true);
    setReportCount((c) => c + 1);
    start(async () => {
      try {
        const res = await fetch(`/api/posts/${post.id}/report`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setReportCount(prevReportCount);
          setIsSunk(prevIsSunk);
          setErr(json.error ?? "失敗");
          return;
        }
        if (typeof json.reportCount === "number") {
          setReportCount(json.reportCount);
        }
        if (typeof json.isSunk === "boolean") {
          setIsSunk(json.isSunk);
        }
      } catch {
        setReportCount(prevReportCount);
        setIsSunk(prevIsSunk);
        setErr("通信に失敗しました");
      } finally {
        setPendingReport(false);
      }
    });
  }

  function moderate(action: "sink" | "unsink" | "pin" | "unpin") {
    if (pendingModeration) return;
    setErr(null);
    const prevIsPinned = isPinned;
    const prevIsSunk = isSunk;
    setPendingModeration(true);
    if (action === "pin") setIsPinned(true);
    if (action === "unpin") setIsPinned(false);
    if (action === "sink") setIsSunk(true);
    if (action === "unsink") setIsSunk(false);
    start(async () => {
      try {
        const res = await fetch(`/api/posts/${post.id}/moderate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setIsPinned(prevIsPinned);
          setIsSunk(prevIsSunk);
          setErr(json.error ?? "失敗");
          return;
        }
        if (typeof json.isPinned === "boolean") {
          setIsPinned(json.isPinned);
        }
        if (typeof json.isSunk === "boolean") {
          setIsSunk(json.isSunk);
        }
      } catch {
        setIsPinned(prevIsPinned);
        setIsSunk(prevIsSunk);
        setErr("通信に失敗しました");
      } finally {
        setPendingModeration(false);
      }
    });
  }

  function mapEditError(code: string | undefined): string {
    switch (code) {
      case "empty_body":
        return "本文を入力してください。";
      case "too_long":
        return `本文は${MAX_BODY_LENGTH}文字以内で入力してください。`;
      case "forbidden":
        return "この投稿は編集できません。";
      case "edit_window_expired":
        return "編集期限(投稿後10分)を過ぎたため、本文は固定されました。";
      case "post_has_reactions":
        return "反応が付いた投稿は重力整合性のため編集できません。";
      case "post_has_replies":
        return "返信が付いた投稿は文脈保全のため編集できません。";
      case "post_reported":
      case "post_moderated":
        return "通報またはモデレーション対象の投稿は編集できません。";
      default:
        return "編集に失敗しました。時間をおいて再試行してください。";
    }
  }

  function saveEdit() {
    if (pendingEdit) return;
    setErr(null);
    const trimmed = editDraft.trim();
    if (!trimmed) {
      setErr("本文を入力してください。");
      return;
    }
    if (editDraft.length > MAX_BODY_LENGTH) {
      setErr(`本文は${MAX_BODY_LENGTH}文字以内で入力してください。`);
      return;
    }
    setPendingEdit(true);
    start(async () => {
      try {
        const res = await fetch(`/api/posts/${post.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: trimmed }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErr(mapEditError(json.error));
          return;
        }
        setBodyText(typeof json.body === "string" ? json.body : trimmed);
        if (typeof json.editedAt === "number") {
          setEditedAt(json.editedAt);
        }
        setEditOpen(false);
      } catch {
        setErr("通信に失敗しました");
      } finally {
        setPendingEdit(false);
      }
    });
  }

  // 沈殿表現: 透過と文字サイズで可視化 (ピン留めは沈ませない)
  const visualSediment = isPinned ? 0 : isSunk ? 0.85 : sediment;
  const opacity = 1 - visualSediment * 0.55;
  const fontSize = 0.95 + (1 - visualSediment) * 0.1;

  const bg = isPinned
    ? "color-mix(in oklab, var(--panel) 80%, var(--accent) 8%)"
    : post.isAdminPost
      ? "color-mix(in oklab, var(--panel) 88%, var(--accent) 4%)"
      : "var(--panel)";
  const distortionNormalized = Math.min(1, distortionLevel);
  const distortionOpacity = 0.12 + distortionNormalized * 0.34;
  const distortionBlur = 8 + distortionNormalized * 16;
  const gravityDelayMs = Math.min(depth, 4) * 70;
  const gravityDurationMs = 520 + distortionNormalized * 260;
  const replyPreview = replyContext?.body.trim().slice(0, 120);
  const overEditLimit = editDraft.length > MAX_BODY_LENGTH;
  const secondaryReactionOrder = REACTION_ORDER.filter(
    (k) => !PRIMARY_REACTION_ORDER.includes(k)
  );

  useEffect(() => {
    const hashTarget = `reply-${post.id}`;

    const openByHash = () => {
      const current = window.location.hash.replace(/^#/, "");
      if (current !== hashTarget) return;
      setReplyOpen(true);
      setAutoFocusReply(true);
    };

    openByHash();
    window.addEventListener("hashchange", openByHash);
    return () => window.removeEventListener("hashchange", openByHash);
  }, [post.id]);

  return (
    <article
      id={`post-${post.id}`}
      className={`gravity-card rounded-md border border-[var(--border)] p-3 transition ${
        isMyPost ? "gravity-distortion gravity-card--distorted" : ""
      }`}
      style={{
        backgroundColor: bg,
        opacity,
        marginLeft: depth > 0 ? Math.min(depth, 3) * 16 : 0,
        boxShadow: isMyPost
          ? `0 0 ${distortionBlur}px color-mix(in oklab, var(--accent) 35%, transparent)`
          : undefined,
        ["--distortion-opacity" as string]: String(distortionOpacity),
        ["--distortion-level" as string]: String(distortionNormalized),
        ["--gravity-delay" as string]: `${gravityDelayMs}ms`,
        ["--gravity-duration" as string]: `${gravityDurationMs}ms`,
      }}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 justify-between text-xs text-[var(--muted)] mb-1">
        <span className="flex items-center gap-1.5 flex-wrap">
          {isPinned && (
            <span className="text-[var(--accent)] font-medium">📌 ピン留め</span>
          )}
          {isSunk && <span className="text-[var(--warn)]">沈降中</span>}
          {post.isAdminPost && (
            <span className="text-[var(--accent)] mr-1">【管理者】</span>
          )}
          <span
            className={
              post.identityMode === "named"
                ? "text-[var(--foreground)]"
                : "text-[var(--muted)]"
            }
          >
            {displayName}
          </span>
          <span className="opacity-60">
            · {post.identityMode === "named" ? "記名" : "匿名"}
          </span>
          {isMyPost && (
            <span className="text-[var(--accent)] font-medium">
              · あなたの歪み {Math.round(distortionLevel * 100)}
            </span>
          )}
        </span>
        <span title={`gravity=${gravity.toFixed(2)} replies=${replyCount} 参加=${participants}`}>
          <button
            type="button"
            onClick={() => setChartOpen((v) => !v)}
            className="hover:text-[var(--accent)] transition"
            aria-expanded={chartOpen}
          >
            重力 {gravity.toFixed(1)}
          </button>{" "}· 返信 {replyCount}
        </span>
      </header>
      <div style={{ fontSize: `${fontSize}rem` }}>
        {replyContext && (
          <div className="mb-2 rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-xs text-[var(--muted)] leading-relaxed">
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <a
                href={`#post-${replyContext.postId}`}
                className="text-[var(--accent)] hover:underline"
              >
                ↪ {replyContext.displayName} への返信
              </a>
              <span>({new Date(replyContext.createdAt).toLocaleString("ja-JP")})</span>
              <span>+{formatLagJP(replyContext.lagMs)}</span>
            </span>
            {replyPreview && (
              <span className="mt-1 block whitespace-pre-wrap break-words">「{replyPreview}」</span>
            )}
          </div>
        )}
        {editOpen ? (
          <div className="space-y-2">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={4}
              className="w-full resize-y rounded border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className={overEditLimit ? "text-[var(--warn)]" : "text-[var(--muted)]"}>
                {editDraft.length}/{MAX_BODY_LENGTH}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditDraft(bodyText);
                    setErr(null);
                  }}
                  className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={pendingEdit || !editDraft.trim() || overEditLimit}
                  className="rounded bg-[var(--accent)] px-2 py-0.5 text-xs text-black font-medium disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{bodyText}</p>
        )}
      </div>
      {chartOpen && (
        <div className="mt-2 w-full overflow-x-auto rounded border border-[var(--border)] bg-[var(--panel)] p-2">
          <GravityChart
            post={post}
            baseScore={gravity}
            events={events}
            halfLifeHours={halfLifeHours}
          />
        </div>
      )}
      <footer className="mt-3 space-y-2">
        <div className="grid grid-cols-3 gap-2 sm:hidden">
          {PRIMARY_REACTION_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              disabled={!!pendingReaction}
              onClick={() => react(k)}
              className="min-h-10 rounded border border-[var(--border)] px-2 text-xs transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              title={REACTION_LABEL[k]}
              aria-label={`${REACTION_LABEL[k]} リアクション`}
            >
              <span aria-hidden>{REACTION_ICON[k]}</span>
              <span>{REACTION_LABEL[k]}</span>
              <span className="text-[var(--muted)]">{reactions[k] ?? 0}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReplyOpen((v) => !v)}
            className="min-h-10 rounded bg-[var(--accent)] px-2 text-xs font-semibold text-black"
          >
            返信
          </button>
        </div>

        <details className="rounded border border-[var(--border)] bg-[var(--panel-2)] p-2 sm:hidden">
          <summary className="cursor-pointer text-xs text-[var(--muted)]">その他の操作</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {secondaryReactionOrder.map((k) => (
              <button
                key={k}
                type="button"
                disabled={!!pendingReaction}
                onClick={() => react(k)}
                className={`text-xs px-2 py-1 rounded border transition disabled:opacity-50 inline-flex items-center gap-1 ${
                  k === "heavy"
                    ? "border-[var(--border)] text-[var(--muted)] hover:border-[var(--warn)] hover:text-[var(--warn)]"
                    : "border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
                title={REACTION_LABEL[k]}
                aria-label={`${REACTION_LABEL[k]} リアクション`}
              >
                <span aria-hidden>{REACTION_ICON[k]}</span>
                <span>{REACTION_LABEL[k]}</span>
                <span className="text-[var(--muted)]">{reactions[k] ?? 0}</span>
              </button>
            ))}
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setErr(null);
                  setEditDraft(bodyText);
                  setEditOpen((v) => !v);
                }}
                className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
              >
                {editOpen ? "編集を閉じる" : "編集"}
              </button>
            )}
            <button
              type="button"
              onClick={report}
              disabled={pendingReport}
              className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--warn)] hover:text-[var(--warn)] transition disabled:opacity-50 inline-flex items-center gap-1"
              title="通報する"
            >
              <span aria-hidden>🚩</span>
              通報 {reportCount > 0 && <span>{reportCount}</span>}
            </button>
          </div>
          {(meIsAdmin || canDelete) && (
            <div className="mt-2 rounded border border-[var(--warn)]/35 bg-[var(--panel)] px-2 py-2">
              <p className="mb-1 text-[10px] text-[var(--muted)]">管理操作</p>
              <div className="flex flex-wrap gap-1.5">
                {meIsAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => moderate(isPinned ? "unpin" : "pin")}
                      disabled={pendingModeration}
                      className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                    >
                      {isPinned ? "ピン解除" : "ピン留め"}
                    </button>
                    <button
                      type="button"
                      onClick={() => moderate(isSunk ? "unsink" : "sink")}
                      disabled={pendingModeration}
                      className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--warn)] hover:text-[var(--warn)] transition"
                    >
                      {isSunk ? "沈降解除" : "沈降"}
                    </button>
                  </>
                )}
                {canDelete && (
                  <AdminDeleteButton
                    endpoint={`/api/posts/${post.id}`}
                    label="削除"
                    confirmMessage={
                      post.replyTo
                        ? "このコメントを削除します。返信がある場合は返信ツリーも削除されます。よろしいですか?"
                        : "この投稿を削除します。返信がある場合は返信ツリーも削除されます。よろしいですか?"
                    }
                    variant="default"
                  />
                )}
              </div>
            </div>
          )}
        </details>

        <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
          {REACTION_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              disabled={!!pendingReaction}
              onClick={() => react(k)}
              className={`text-xs px-2 py-0.5 rounded border transition disabled:opacity-50 inline-flex items-center gap-1 ${
                k === "heavy"
                  ? "border-[var(--border)] text-[var(--muted)] hover:border-[var(--warn)] hover:text-[var(--warn)]"
                  : "border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
              title={REACTION_LABEL[k]}
              aria-label={`${REACTION_LABEL[k]} リアクション`}
            >
              <span aria-hidden>{REACTION_ICON[k]}</span>
              <span>{REACTION_LABEL[k]}</span>
              <span className="text-[var(--muted)]">{reactions[k] ?? 0}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReplyOpen((v) => !v)}
            className="text-xs px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
          >
            返信
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setErr(null);
                setEditDraft(bodyText);
                setEditOpen((v) => !v);
              }}
              className="text-xs px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              {editOpen ? "編集を閉じる" : "編集"}
            </button>
          )}
          <button
            type="button"
            onClick={report}
            disabled={pendingReport}
            className="text-xs px-2 py-0.5 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--warn)] hover:text-[var(--warn)] transition disabled:opacity-50 inline-flex items-center gap-1"
            title="通報する"
          >
            <span aria-hidden>🚩</span>
            通報 {reportCount > 0 && <span>{reportCount}</span>}
          </button>
          {meIsAdmin && (
            <>
              <button
                type="button"
                onClick={() => moderate(isPinned ? "unpin" : "pin")}
                disabled={pendingModeration}
                className="text-xs px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
              >
                {isPinned ? "ピン解除" : "ピン留め"}
              </button>
              <button
                type="button"
                onClick={() => moderate(isSunk ? "unsink" : "sink")}
                disabled={pendingModeration}
                className="text-xs px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--warn)] hover:text-[var(--warn)] transition"
              >
                {isSunk ? "沈降解除" : "沈降"}
              </button>
            </>
          )}
          {canDelete && (
            <AdminDeleteButton
              endpoint={`/api/posts/${post.id}`}
              label="削除"
              confirmMessage={
                post.replyTo
                  ? "このコメントを削除します。返信がある場合は返信ツリーも削除されます。よろしいですか?"
                  : "この投稿を削除します。返信がある場合は返信ツリーも削除されます。よろしいですか?"
              }
              variant="default"
            />
          )}
        </div>

        {err && (
          <span className="text-xs text-[var(--warn)]">{err}</span>
        )}
        {!canEdit && editDisabledReason && (
          <span className="text-xs text-[var(--muted)]">
            編集不可: {mapEditError(editDisabledReason)}
          </span>
        )}
        {typeof editedAt === "number" && editedAt > post.createdAt && (
          <span className="text-xs text-[var(--muted)]">編集: {new Date(editedAt).toLocaleString("ja-JP")}</span>
        )}
        <span className="text-xs text-[var(--muted)] sm:ml-auto">
          {new Date(post.createdAt).toLocaleString("ja-JP")}
        </span>
      </footer>
      {replyOpen && (
        <ReplyComposer
          threadId={threadId}
          replyTo={post.id}
          replyToDisplayName={displayName}
          replyToPreview={bodyText}
          canBeAnonymous={meIsAnonymous}
          autoFocus={autoFocusReply}
          onDone={() => {
            setReplyOpen(false);
            setAutoFocusReply(false);
          }}
        />
      )}
    </article>
  );
}
