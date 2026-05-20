"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Post, ReactionKind } from "@/lib/domain/types";
import { REACTION_LABEL } from "@/lib/domain/types";
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
  threadId,
  depth = 0,
  halfLifeHours,
}: {
  post: Post;
  displayName: string;
  gravity: number;
  sediment: number;
  replyCount: number;
  participants: number;
  meIsAdmin: boolean;
  meIsAnonymous: boolean;
  threadId: string;
  depth?: number;
  halfLifeHours?: number;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [reactions, setReactions] = useState(post.reactions);
  const [reportCount, setReportCount] = useState(post.reportCount);
  const [isPinned, setIsPinned] = useState(post.isPinned);
  const [isSunk, setIsSunk] = useState(post.isSunk);
  const [err, setErr] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  function react(kind: ReactionKind) {
    setErr(null);
    start(async () => {
      const res = await fetch(`/api/posts/${post.id}/reactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "失敗");
        return;
      }
      setReactions(json.reactions);
      router.refresh();
    });
  }

  function report() {
    if (!confirm("この投稿を通報しますか?")) return;
    setErr(null);
    start(async () => {
      const res = await fetch(`/api/posts/${post.id}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "失敗");
        return;
      }
      setReportCount(json.reportCount);
      setIsSunk(json.isSunk);
      router.refresh();
    });
  }

  function moderate(action: "sink" | "unsink" | "pin" | "unpin") {
    setErr(null);
    start(async () => {
      const res = await fetch(`/api/posts/${post.id}/moderate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "失敗");
        return;
      }
      setIsPinned(json.isPinned);
      setIsSunk(json.isSunk);
      router.refresh();
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

  return (
    <article
      className="rounded-md border border-[var(--border)] p-3 transition"
      style={{
        backgroundColor: bg,
        opacity,
        marginLeft: depth > 0 ? Math.min(depth, 3) * 16 : 0,
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
        className="whitespace-pre-wrap leading-relaxed"
        style={{ fontSize: `${fontSize}rem` }}
      >
        {post.body}
      </p>
      {chartOpen && (
        <div className="mt-2 rounded border border-[var(--border)] bg-[var(--panel)] p-2 inline-block">
          <GravityChart
            post={post}
            baseScore={gravity}
            halfLifeHours={halfLifeHours}
          />
        </div>
      )}
      <footer className="mt-3 flex flex-wrap items-center gap-1.5">
        {REACTION_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            disabled={pending}
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
          disabled={pending}
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
              disabled={pending}
              className="text-xs px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              {isPinned ? "ピン解除" : "ピン留め"}
            </button>
            <button
              type="button"
              onClick={() => moderate(isSunk ? "unsink" : "sink")}
              disabled={pending}
              className="text-xs px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--warn)] hover:text-[var(--warn)] transition"
            >
              {isSunk ? "沈降解除" : "沈降"}
            </button>
          </>
        )}
        {err && (
          <span className="text-xs text-[var(--warn)] ml-2">{err}</span>
        )}
        <span className="ml-auto text-xs text-[var(--muted)]">
          {new Date(post.createdAt).toLocaleString("ja-JP")}
        </span>
      </footer>
      {replyOpen && (
        <ReplyComposer
          threadId={threadId}
          replyTo={post.id}
          canBeAnonymous={meIsAnonymous}
          onDone={() => setReplyOpen(false)}
        />
      )}
    </article>
  );
}
