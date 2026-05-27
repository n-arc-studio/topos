"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function NewThreadForm({ spaceId }: { spaceId: string }) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const res = await fetch("/api/threads", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ spaceId, title }),
          });
          const json = await res.json();
          if (!res.ok) {
            if (res.status === 401) {
              router.push(`/login?next=${encodeURIComponent(`/spaces/${spaceId}`)}`);
              return;
            }
            setErr(json.error ?? "失敗");
            return;
          }
          setTitle("");
          router.refresh();
          router.push(`/spaces/${spaceId}/threads/${json.id}`);
        });
      }}
      className="flex gap-2"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="スレッドのタイトル (この場の文脈に沿ったテーマ)"
        className="flex-1 bg-[var(--panel-2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50"
      >
        建てる
      </button>
      {err && <span className="text-xs text-[var(--warn)] self-center">{err}</span>}
    </form>
  );
}
