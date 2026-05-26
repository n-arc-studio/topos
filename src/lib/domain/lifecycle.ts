import type { Space, SpaceCandidate, SpaceLifecycle } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const ACTIVE_TO_DORMANT_MS = 30 * DAY;
export const DORMANT_TO_SUCCESSION_MS = 14 * DAY;
export const SUCCESSION_DURATION_MS = 14 * DAY;
export const MAX_VACATION_MS = 60 * DAY;

export interface LifecycleThresholds {
  activeToDormantMs?: number;
  dormantToSuccessionMs?: number;
  successionDurationMs?: number;
}

export interface LifecycleSnapshot {
  lifecycle: SpaceLifecycle;
  lifecycleSince: number;
  successionDeadline?: number;
  candidates?: SpaceCandidate[];
  frozenAt?: number;
  changed: boolean;
}

function resolveThresholds(t?: LifecycleThresholds) {
  return {
    activeToDormantMs: t?.activeToDormantMs ?? ACTIVE_TO_DORMANT_MS,
    dormantToSuccessionMs: t?.dormantToSuccessionMs ?? DORMANT_TO_SUCCESSION_MS,
    successionDurationMs: t?.successionDurationMs ?? SUCCESSION_DURATION_MS,
  };
}

function normalizeSpace(space: Space): Required<Pick<Space, "lifecycle" | "lifecycleSince" | "lastAdminActionAt">> {
  const now = Date.now();
  return {
    lifecycle: space.lifecycle ?? "active",
    lifecycleSince: space.lifecycleSince ?? space.createdAt,
    lastAdminActionAt: space.lastAdminActionAt ?? now,
  };
}

export function evaluateLifecycle(
  space: Space,
  now: number,
  thresholds?: LifecycleThresholds
): LifecycleSnapshot {
  const th = resolveThresholds(thresholds);
  const normalized = normalizeSpace(space);
  const effectiveLastAdminActionAt =
    space.vacationUntil && space.vacationUntil > now
      ? now
      : normalized.lastAdminActionAt;

  const current: LifecycleSnapshot = {
    lifecycle: normalized.lifecycle,
    lifecycleSince: normalized.lifecycleSince,
    successionDeadline: space.successionDeadline,
    candidates: space.candidates,
    frozenAt: space.frozenAt,
    changed: false,
  };

  switch (normalized.lifecycle) {
    case "active": {
      const idle = now - effectiveLastAdminActionAt;
      if (idle >= th.activeToDormantMs) {
        return {
          lifecycle: "dormant",
          lifecycleSince: now,
          changed: true,
        };
      }
      return current;
    }
    case "dormant": {
      const idle = now - effectiveLastAdminActionAt;
      if (idle < th.activeToDormantMs) {
        return {
          lifecycle: "active",
          lifecycleSince: now,
          changed: true,
        };
      }
      const inDormant = now - normalized.lifecycleSince;
      if (inDormant >= th.dormantToSuccessionMs) {
        return {
          lifecycle: "succession",
          lifecycleSince: now,
          successionDeadline: now + th.successionDurationMs,
          candidates: [],
          changed: true,
        };
      }
      return current;
    }
    case "succession": {
      const idle = now - effectiveLastAdminActionAt;
      if (idle < th.activeToDormantMs) {
        return {
          lifecycle: "active",
          lifecycleSince: now,
          successionDeadline: undefined,
          candidates: undefined,
          changed: true,
        };
      }
      const deadline = space.successionDeadline ?? now;
      if (now >= deadline) {
        const candidates = space.candidates ?? [];
        if (candidates.length === 0) {
          return {
            lifecycle: "archived",
            lifecycleSince: now,
            successionDeadline: undefined,
            candidates: undefined,
            frozenAt: now,
            changed: true,
          };
        }
      }
      return current;
    }
    case "archived":
      return current;
    default:
      return current;
  }
}

export function isWritable(space: Space): boolean {
  return (space.lifecycle ?? "active") !== "archived";
}

export function effectiveNow(space: Space, now: number): number {
  if ((space.lifecycle ?? "active") === "archived" && space.frozenAt) {
    return space.frozenAt;
  }
  return now;
}
