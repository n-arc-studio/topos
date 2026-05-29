"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminRoleForm({
  spaceId,
  selfUserId,
}: {
  spaceId: string;
  selfUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [targetUserId, setTargetUserId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function run(mode: "grant" | "revoke") {
    const target = targetUserId.trim();
    if (!target) {
      setErr("対象ユーザーIDを入力してください");
      return;
    }
    if (mode === "revoke" && target === selfUserId) {
      setErr("自分自身の剥奪はこの画面からは実行できません");
      return;
    }

    const actionLabel = mode === "grant" ? "付与" : "剥奪";
    if (!confirm(`管理者権限を${actionLabel}します。よろしいですか?`)) {
      return;
    }

    setErr(null);
    setOk(null);
    start(async () => {
      const res = await fetch(`/api/spaces/${spaceId}/admin/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId: target }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? "失敗");
        return;
      }
      setOk(`管理者権限を${actionLabel}しました`);
      setTargetUserId("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 space-y-3">
      <h3 className="text-sm font-medium">管理者権限の付与 / 剥奪</h3>
      <p className="text-xs text-[var(--muted)]">
        ユーザー内部IDを指定して権限を操作します。実行前に必ず確認してください。
      </p>
      <label className="text-xs flex flex-col gap-1">
        <span className="text-[var(--muted)]">対象ユーザーID</span>
        <input
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
          placeholder="u_xxxxxxxx"
          className="bg-transparent border border-[var(--border)] rounded px-2 py-1 text-sm"
          disabled={pending}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => run("grant")}
          disabled={pending}
          className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50"
        >
          {pending ? "処理中..." : "付与"}
        </button>
        <button
          type="button"
          onClick={() => run("revoke")}
          disabled={pending}
          className="px-3 py-1 text-xs rounded border border-[var(--border)] hover:border-[var(--warn)] hover:text-[var(--warn)] disabled:opacity-50"
        >
          {pending ? "処理中..." : "剥奪"}
        </button>
        {ok && <span className="text-xs text-[var(--accent)]">{ok}</span>}
        {err && <span className="text-xs text-[var(--warn)]">{err}</span>}
      </div>
    </div>
  );
}
