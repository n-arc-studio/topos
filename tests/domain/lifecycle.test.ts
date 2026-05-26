import { describe, expect, test } from "vitest";
import {
  ACTIVE_TO_DORMANT_MS,
  DORMANT_TO_SUCCESSION_MS,
  SUCCESSION_DURATION_MS,
  evaluateLifecycle,
  isWritable,
} from "@/lib/domain/lifecycle";
import type { Space } from "@/lib/domain/types";

function makeSpace(partial: Partial<Space> = {}): Space {
  const now = 1_000_000;
  return {
    id: "s1",
    name: "space",
    charter: "charter",
    adminIds: ["u1"],
    createdAt: now,
    lifecycle: "active",
    lifecycleSince: now,
    lastAdminActionAt: now,
    ...partial,
  };
}

describe("lifecycle", () => {
  test("active becomes dormant after inactivity threshold", () => {
    const space = makeSpace();
    const now = (space.lastAdminActionAt ?? 0) + ACTIVE_TO_DORMANT_MS;
    const snap = evaluateLifecycle(space, now);
    expect(snap.changed).toBe(true);
    expect(snap.lifecycle).toBe("dormant");
  });

  test("dormant becomes succession after dormant period", () => {
    const base = makeSpace({
      lifecycle: "dormant",
      lifecycleSince: 1000,
      lastAdminActionAt: -(ACTIVE_TO_DORMANT_MS + 1000),
    });
    const now = (base.lifecycleSince ?? 0) + DORMANT_TO_SUCCESSION_MS;
    const snap = evaluateLifecycle(base, now);
    expect(snap.lifecycle).toBe("succession");
    expect(snap.successionDeadline).toBe(now + SUCCESSION_DURATION_MS);
    expect(snap.candidates).toEqual([]);
  });

  test("succession with no candidates becomes archived after deadline", () => {
    const space = makeSpace({
      lifecycle: "succession",
      lifecycleSince: 1_000,
      lastAdminActionAt: -(ACTIVE_TO_DORMANT_MS + 1000),
      successionDeadline: 2_000,
      candidates: [],
    });
    const snap = evaluateLifecycle(space, 2_000);
    expect(snap.lifecycle).toBe("archived");
    expect(snap.frozenAt).toBe(2_000);
  });

  test("vacation postpones inactivity transition", () => {
    const now = 2_000_000;
    const space = makeSpace({
      lastAdminActionAt: now - ACTIVE_TO_DORMANT_MS - 1,
      vacationUntil: now + 10_000,
    });
    const snap = evaluateLifecycle(space, now);
    expect(snap.lifecycle).toBe("active");
    expect(snap.changed).toBe(false);
  });

  test("archived space is read-only", () => {
    expect(isWritable(makeSpace({ lifecycle: "active" }))).toBe(true);
    expect(isWritable(makeSpace({ lifecycle: "archived" }))).toBe(false);
  });
});
