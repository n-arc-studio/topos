"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminDeleteButton({
  endpoint,
  label,
  confirmMessage,
  redirectTo,
  variant = "danger",
}: {
  endpoint: string;
  label: string;
  confirmMessage: string;
  redirectTo?: string;
  variant?: "danger" | "default";
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    if (!confirm(confirmMessage)) return;
    setErr(null);
    start(async () => {
      const res = await fetch(endpoint, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? "失敗");
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    });
  }

  const buttonClass =
    variant === "danger"
      ? "hover:border-[var(--warn)] hover:text-[var(--warn)]"
      : "hover:border-[var(--accent)] hover:text-[var(--accent)]";

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`text-xs px-2 py-1 rounded border border-[var(--border)] transition disabled:opacity-50 ${buttonClass}`}
      >
        {pending ? "処理中..." : label}
      </button>
      {err && <span className="text-xs text-[var(--warn)]">{err}</span>}
    </span>
  );
}
