"use client";

import { useState, useTransition } from "react";
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
];

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
  threadId,
  depth = 0,
  halfLifeHours,
  events,
  isMyPost = false,
  distortionLevel = 0,
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
  threadId: string;
  depth?: number;
  halfLifeHours?: number;
  events?: GravityEvent[];
  isMyPost?: boolean;
  distortionLevel?: number;
}) {
  const [, start] = useTransition();
  const [pendingReaction, setPendingReaction] = useState<ReactionKind | null>(null);
  const [pendingReport, setPendingReport] = useState(false);
  const [pendingModeration, setPendingModeration] = useState(false);
  const [reactions, setReactions] = useState(post.reactions);
  const [reportCount, setReportCount] = useState(post.reportCount);
  const [isPinned, setIsPinned] = useState(post.isPinned);
  const [isSunk, setIsSunk] = useState(post.isSunk);
  const [err, setErr] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
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

  return (
    <article
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
      <p
        className="whitespace-pre-wrap break-words leading-relaxed"
        style={{ fontSize: `${fontSize}rem` }}
      >
        {post.body}
      </p>
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
      <footer className="mt-3 flex flex-wrap items-center gap-1.5">
        {REACTION_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            disabled={!!pendingReaction}
            onClick={() => react(k)}
            className="text-xs px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition disabled:opacity-50"
            title={REACTION_LABEL[k]}
          >
            {REACTION_LABEL[k]}{" "}
            <span className="text-[var(--muted)]">{reactions[k]}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setReplyOpen((v) => !v)}
          className="text-xs px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
        >
          返信
        </button>
        <button
          type="button"
          onClick={report}
          disabled={pendingReport}
          className="text-xs px-2 py-0.5 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--warn)] hover:text-[var(--warn)] transition disabled:opacity-50"
          title="通報する"
        >
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
        {err && (
          <span className="text-xs text-[var(--warn)]">{err}</span>
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
          replyToPreview={post.body}
          canBeAnonymous={meIsAnonymous}
          onDone={() => setReplyOpen(false)}
        />
      )}
    </article>
  );
}
