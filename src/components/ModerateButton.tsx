"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Action = "sink" | "unsink" | "pin" | "unpin";

export function ModerateButton({
  postId,
  action,
  label,
  variant = "default",
}: {
  postId: string;
  action: Action;
  label: string;
  variant?: "default" | "warn";
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    setErr(null);
    start(async () => {
      const res = await fetch(`/api/posts/${postId}/moderate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? "失敗");
        return;
      }
      router.refresh();
    });
  }

  const hoverClass =
    variant === "warn"
      ? "hover:border-[var(--warn)] hover:text-[var(--warn)]"
      : "hover:border-[var(--accent)] hover:text-[var(--accent)]";

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`text-xs px-2 py-0.5 rounded border border-[var(--border)] transition disabled:opacity-50 ${hoverClass}`}
      >
        {pending ? "処理中..." : label}
      </button>
      {err && <span className="text-xs text-[var(--warn)]">{err}</span>}
    </span>
  );
}
