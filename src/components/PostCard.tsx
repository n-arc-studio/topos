"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Post, ReactionKind } from "@/lib/domain/types";

const LABELS: Record<ReactionKind, string> = {
  kusa: "いいね",
  useful: "参考になった",
  patch: "修正提案",
  debug: "不具合報告",
};

export function PostCard({
  post,
  displayName,
  gravity,
  sediment,
}: {
  post: Post;
  displayName: string;
  gravity: number;
  sediment: number; // 0..1: 大きいほど沈殿
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [localReactions, setLocalReactions] = useState(post.reactions);
  const [err, setErr] = useState<string | null>(null);

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
      setLocalReactions(json.reactions);
      router.refresh();
    });
  }

  // 沈殿エフェクト: 透過と文字サイズで可視化
  const opacity = 1 - sediment * 0.7;
  const fontSize = 0.9 + (1 - sediment) * 0.2; // 0.9..1.1rem

  return (
    <article
      className="rounded-md border border-[var(--border)] p-3 transition"
      style={{
        backgroundColor: post.isAdminPost
          ? "color-mix(in oklab, var(--panel) 80%, var(--accent) 5%)"
          : "var(--panel)",
        opacity,
      }}
    >
      <header className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
        <span>
          {post.isAdminPost && (
            <span className="text-[var(--accent)] mr-1">【時空管理者】</span>
          )}
          <span
            className={
              post.identityMode === "named"
                ? "text-[var(--foreground)]"
                : "text-[var(--muted)]"
            }
          >
            {displayName}
          </span>{" "}
          <span className="opacity-60">
            · {post.identityMode === "named" ? "記名" : "匿名"}
          </span>
        </span>
        <span title={`gravity=${gravity.toFixed(2)} sediment=${sediment.toFixed(2)}`}>
          重力 {gravity.toFixed(1)}
        </span>
      </header>
      <p
        className="whitespace-pre-wrap leading-relaxed"
        style={{ fontSize: `${fontSize}rem` }}
      >
        {post.body}
      </p>
      <footer className="mt-3 flex flex-wrap items-center gap-1.5">
        {(Object.keys(LABELS) as ReactionKind[]).map((k) => (
          <button
            key={k}
            type="button"
            disabled={pending}
            onClick={() => react(k)}
            className="text-xs px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition disabled:opacity-50"
            title={LABELS[k]}
          >
            {LABELS[k]}{" "}
            <span className="text-[var(--muted)]">{localReactions[k]}</span>
          </button>
        ))}
        {err && (
          <span className="text-xs text-[var(--warn)] ml-2">{err}</span>
        )}
        <span className="ml-auto text-xs text-[var(--muted)]">
          {new Date(post.createdAt).toLocaleString("ja-JP")}
        </span>
      </footer>
    </article>
  );
}
