"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SpaceGravityConfig } from "@/lib/domain/gravity-config";
import {
  DEFAULT_HALF_LIFE_HOURS,
  DEFAULT_REPLY_W,
  DEFAULT_PARTICIPANT_W,
  DEFAULT_REPORT_PENALTY,
  DEFAULT_SUNK_DAMP,
  DEFAULT_SEED,
  DEFAULT_USER_MASS_BONUS,
} from "@/lib/domain/gravity";

type FieldKey =
  | "halfLifeHours"
  | "replyWeight"
  | "participantWeight"
  | "reportPenalty"
  | "sunkDamp"
  | "seed"
  | "userMassBonus";

const FIELDS: Array<{ key: FieldKey; label: string; def: number; step: number }> = [
  { key: "halfLifeHours", label: "半減期 (時間)", def: DEFAULT_HALF_LIFE_HOURS, step: 1 },
  { key: "replyWeight", label: "返信の重み", def: DEFAULT_REPLY_W, step: 0.1 },
  { key: "participantWeight", label: "参加者の重み", def: DEFAULT_PARTICIPANT_W, step: 0.1 },
  { key: "reportPenalty", label: "通報1件あたり減衰", def: DEFAULT_REPORT_PENALTY, step: 0.05 },
  { key: "sunkDamp", label: "沈降時の倍率", def: DEFAULT_SUNK_DAMP, step: 0.05 },
  { key: "seed", label: "新規投稿の種", def: DEFAULT_SEED, step: 0.1 },
  { key: "userMassBonus", label: "質量ボーナス係数", def: DEFAULT_USER_MASS_BONUS, step: 0.1 },
];

export function SpaceConfigForm({
  spaceId,
  spaceName,
  initial,
}: {
  spaceId: string;
  spaceName: string;
  initial: SpaceGravityConfig | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [values, setValues] = useState<Record<FieldKey, string>>(() => {
    const v = {} as Record<FieldKey, string>;
    for (const f of FIELDS) {
      const cur = initial?.[f.key];
      v[f.key] = typeof cur === "number" ? String(cur) : "";
    }
    return v;
  });

  function save() {
    setErr(null);
    setOk(false);
    const cfg: SpaceGravityConfig = {};
    for (const f of FIELDS) {
      const raw = values[f.key].trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        setErr(`${f.label} の値が不正です`);
        return;
      }
      (cfg as Record<string, number>)[f.key] = n;
    }
    start(async () => {
      const res = await fetch(`/api/spaces/${spaceId}/config`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gravityConfig: cfg }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? "失敗");
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  function reset() {
    if (!confirm(`${spaceName} の係数を既定値に戻します。よろしいですか?`)) return;
    setErr(null);
    setOk(false);
    start(async () => {
      const res = await fetch(`/api/spaces/${spaceId}/config`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gravityConfig: null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "失敗");
        return;
      }
      const v = {} as Record<FieldKey, string>;
      for (const f of FIELDS) v[f.key] = "";
      setValues(v);
      setOk(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{spaceName} の物理係数</h3>
        <span className="text-xs text-[var(--muted)]">空欄=既定値</span>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="text-xs flex flex-col gap-1">
            <span className="text-[var(--muted)]">
              {f.label}{" "}
              <span className="opacity-50">(既定 {f.def})</span>
            </span>
            <input
              type="number"
              step={f.step}
              min={0}
              value={values[f.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
              placeholder={String(f.def)}
              className="bg-transparent border border-[var(--border)] rounded px-2 py-1 text-sm"
              disabled={pending}
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="px-3 py-1 text-xs rounded border border-[var(--border)] hover:border-[var(--warn)] hover:text-[var(--warn)] disabled:opacity-50"
        >
          既定値に戻す
        </button>
        {ok && <span className="text-xs text-[var(--accent)]">保存しました</span>}
        {err && <span className="text-xs text-[var(--warn)]">{err}</span>}
      </div>
    </div>
  );
}
