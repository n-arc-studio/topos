"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Destination = {
  id: string;
  name: string;
};

export function ThreadMoveForm({
  threadId,
  threadTitle,
  destinations,
}: {
  threadId: string;
  threadTitle: string;
  destinations: Destination[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [targetSpaceId, setTargetSpaceId] = useState(destinations[0]?.id ?? "");
  const [err, setErr] = useState<string | null>(null);

  if (destinations.length === 0) {
    return <span className="text-[var(--muted)]">移動先なし</span>;
  }

  function run() {
    if (!targetSpaceId) {
      setErr("移動先を選択してください");
      return;
    }
    const target = destinations.find((candidate) => candidate.id === targetSpaceId);
    if (!target) {
      setErr("移動先が不正です");
      return;
    }
    if (!confirm(`スレッド「${threadTitle}」を「${target.name}」へ移動します。よろしいですか?`)) {
      return;
    }

    setErr(null);
    start(async () => {
      const res = await fetch(`/api/threads/${threadId}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetSpaceId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? "失敗");
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={targetSpaceId}
        onChange={(e) => setTargetSpaceId(e.target.value)}
        disabled={pending}
        className="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs"
        aria-label="移動先の場"
      >
        {destinations.map((destination) => (
          <option key={destination.id} value={destination.id}>
            {destination.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-xs px-2 py-1 rounded border border-[var(--border)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        {pending ? "移動中..." : "別の場へ移動"}
      </button>
      {err && <span className="text-xs text-[var(--warn)]">{err}</span>}
    </span>
  );
}