"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login?next=/profile");
          return;
        }
        setMsg(json.error ?? "失敗");
        return;
      }
      setMsg("保存しました");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        <span className="text-[var(--muted)]">表示名</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="mt-1 w-full bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50"
        >
          保存
        </button>
        {msg && (
          <span className="text-xs text-[var(--muted)]">{msg}</span>
        )}
      </div>
    </form>
  );
}
