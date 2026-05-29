"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SpaceCharterForm({
  spaceId,
  spaceName,
  initialCharter,
}: {
  spaceId: string;
  spaceName: string;
  initialCharter: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [charter, setCharter] = useState(initialCharter);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function save() {
    setErr(null);
    setOk(false);
    const nextCharter = charter.trim();
    if (!nextCharter) {
      setErr("憲章を入力してください");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/spaces/${spaceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ charter: nextCharter }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? "失敗");
        return;
      }
      setCharter(json.charter ?? nextCharter);
      setOk(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{spaceName} の憲章</h3>
        <span className="text-xs text-[var(--muted)]">場の文脈を定義</span>
      </header>
      <label className="text-xs flex flex-col gap-1">
        <span className="text-[var(--muted)]">憲章</span>
        <textarea
          value={charter}
          onChange={(e) => setCharter(e.target.value)}
          rows={4}
          className="bg-transparent border border-[var(--border)] rounded px-2 py-1 text-sm leading-relaxed"
          disabled={pending}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存"}
        </button>
        {ok && <span className="text-xs text-[var(--accent)]">保存しました</span>}
        {err && <span className="text-xs text-[var(--warn)]">{err}</span>}
      </div>
    </div>
  );
}