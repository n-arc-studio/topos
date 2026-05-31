"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminSpaceCreateForm() {
  const [name, setName] = useState("");
  const [charter, setCharter] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        setOk(null);
        start(async () => {
          const res = await fetch("/api/spaces", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, charter }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            setErr(json.error ?? "失敗");
            return;
          }
          setName("");
          setCharter("");
          setOk("新しい場を作成しました");
          router.refresh();
        });
      }}
      className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 space-y-3"
    >
      <h3 className="text-sm font-medium">新しい場を作成</h3>
      <label className="text-xs flex flex-col gap-1">
        <span className="text-[var(--muted)]">場の名前</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新しい場のタイトル"
          className="bg-transparent border border-[var(--border)] rounded px-2 py-1 text-sm"
          disabled={pending}
        />
      </label>
      <label className="text-xs flex flex-col gap-1">
        <span className="text-[var(--muted)]">憲章</span>
        <textarea
          value={charter}
          onChange={(e) => setCharter(e.target.value)}
          rows={3}
          placeholder="この場で守る文脈を記述"
          className="bg-transparent border border-[var(--border)] rounded px-2 py-1 text-sm"
          disabled={pending}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending || !name.trim() || !charter.trim()}
          className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50"
        >
          {pending ? "作成中..." : "場を作成"}
        </button>
        {ok && <span className="text-xs text-[var(--accent)]">{ok}</span>}
        {err && <span className="text-xs text-[var(--warn)]">{err}</span>}
      </div>
    </form>
  );
}
