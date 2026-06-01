"use client";

import { useMemo } from "react";
import type { Post, GravityEvent } from "@/lib/domain/types";
import {
  ageDecay,
  DEFAULT_HALF_LIFE_HOURS,
  gravityAt,
  type GravityContext,
} from "@/lib/domain/gravity";

// 投稿1件の重力スコア推移を SVG で描く。
//
// 設計:
//  - events が渡されたら「投稿時刻からのイベントを再生して各サンプル時点 t の gravityAt(t) を計算」する
//  - events が空 (seed 投稿など) のときは従来通りの指数減衰曲線にフォールバック
//  - 縦点線 = 現在時刻
export function GravityChart({
  post,
  baseScore,
  nowMs,
  events,
  context,
  halfLifeHours = DEFAULT_HALF_LIFE_HOURS,
  hoursWindow = 48,
  samples = 48,
}: {
  post: Post;
  baseScore: number; // 現時点の重力スコア (decay 後)
  nowMs: number;
  events?: GravityEvent[];
  context?: Omit<GravityContext, "now">;
  halfLifeHours?: number;
  hoursWindow?: number;
  samples?: number;
}) {
  const { points, maxScore, nowOffsetX, eventMarks } = useMemo(() => {
    const now = nowMs;
    const start = post.createdAt;
    const end = now + hoursWindow * 0.1 * 3600_000; // 少し未来まで
    const span = Math.max(1, end - start);
    const xs: Array<{ t: number; g: number }> = [];

    if (events && events.length > 0) {
      // イベント駆動: 各サンプル時点で gravityAt を再計算
      // 加えてイベント発生 "直前/直後" もサンプルして段差を綺麗に描く
      const sampleTimes = new Set<number>();
      for (let i = 0; i <= samples; i++) {
        sampleTimes.add(start + (span * i) / samples);
      }
      for (const e of events) {
        if (e.at >= start && e.at <= end) {
          sampleTimes.add(e.at - 1);
          sampleTimes.add(e.at);
          sampleTimes.add(e.at + 1);
        }
      }
      const times = [...sampleTimes].sort((a, b) => a - b);
      for (const t of times) {
        xs.push({ t, g: gravityAt(post, events, t, context ?? {}) });
      }
    } else {
      // フォールバック: 純粋な指数減衰
      const currentDecay = ageDecay(post.createdAt, now, halfLifeHours);
      const contentLike = currentDecay > 0 ? baseScore / currentDecay : baseScore;
      for (let i = 0; i <= samples; i++) {
        const t = start + (span * i) / samples;
        const decay = ageDecay(post.createdAt, t, halfLifeHours);
        xs.push({ t, g: contentLike * decay });
      }
    }

    const max = Math.max(0.01, ...xs.map((p) => p.g));
    const nowFrac = (now - start) / span;
    const marks = (events ?? [])
      .filter((e) => e.at >= start && e.at <= end)
      .map((e) => ({ x: (e.at - start) / span, type: e.type }));
    return { points: xs, maxScore: max, nowOffsetX: nowFrac, eventMarks: marks };
  }, [post, baseScore, nowMs, events, context, halfLifeHours, hoursWindow, samples]);

  const W = 220;
  const H = 70;
  const path = points
    .map((p, i) => {
      const x =
        ((p.t - points[0].t) / (points[points.length - 1].t - points[0].t)) *
        W;
      const y = H - (p.g / maxScore) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const markColor = (t: string) =>
    t === "reaction"
      ? "var(--accent)"
      : t === "report" || t === "sink"
        ? "var(--warn)"
        : "var(--muted)";

  return (
    <div style={{ width: W }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block"
        aria-label="重力の時系列推移"
      >
        <line
          x1={0}
          y1={H - 0.5}
          x2={W}
          y2={H - 0.5}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
        {eventMarks.map((m, i) => (
          <line
            key={i}
            x1={m.x * W}
            y1={H - 6}
            x2={m.x * W}
            y2={H}
            stroke={markColor(m.type)}
            strokeWidth={1}
            opacity={0.7}
          />
        ))}
        <line
          x1={nowOffsetX * W}
          y1={0}
          x2={nowOffsetX * W}
          y2={H}
          stroke="var(--warn)"
          strokeDasharray="2 2"
          strokeWidth={0.8}
        />
      </svg>
      <p className="text-[10px] text-[var(--muted)] mt-1 leading-tight">
        半減期 {halfLifeHours}h ・ 縦軸=重力 ・ 点線=現在
        {events && events.length > 0
          ? ` ・ 縦目盛=イベント(${events.length})`
          : " ・ (イベント履歴なし)"}
      </p>
    </div>
  );
}

