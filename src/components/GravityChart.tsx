"use client";

import { useMemo } from "react";
import type { Post } from "@/lib/domain/types";
import { ageDecay, DEFAULT_HALF_LIFE_HOURS } from "@/lib/domain/gravity";

// 投稿1件の「現在の重力スコアの基底値」を、過去 N 時間にわたって時間減衰のみで
// 再計算した曲線を SVG で描く。リアクション履歴はまだ持っていないため、
// 「投稿時刻が最大値、半減期で指数減衰」という Topos の物理を可視化する。
export function GravityChart({
  post,
  baseScore,
  halfLifeHours = DEFAULT_HALF_LIFE_HOURS,
  hoursWindow = 48,
  samples = 32,
}: {
  post: Post;
  baseScore: number; // 現時点の重力スコア (decay 後)
  halfLifeHours?: number;
  hoursWindow?: number;
  samples?: number;
}) {
  const { points, maxScore, nowOffsetX } = useMemo(() => {
    const now = Date.now();
    const start = post.createdAt;
    const end = now + hoursWindow * 0.1 * 3600_000; // 少し未来まで
    const xs: Array<{ t: number; g: number }> = [];
    // 現時点の decay を逆算して content 部分を推定
    const currentDecay = ageDecay(post.createdAt, now, halfLifeHours);
    const contentLike = currentDecay > 0 ? baseScore / currentDecay : baseScore;
    for (let i = 0; i <= samples; i++) {
      const t = start + ((end - start) * i) / samples;
      const decay = ageDecay(post.createdAt, t, halfLifeHours);
      xs.push({ t, g: contentLike * decay });
    }
    const max = Math.max(0.01, ...xs.map((p) => p.g));
    const nowFrac = (now - start) / (end - start);
    return { points: xs, maxScore: max, nowOffsetX: nowFrac };
  }, [post.createdAt, baseScore, halfLifeHours, hoursWindow, samples]);

  const W = 200;
  const H = 60;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - (p.g / maxScore) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="w-[200px]">
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
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
        />
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
      </p>
    </div>
  );
}
