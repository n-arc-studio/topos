import { describe, expect, test } from "vitest";
import {
  ageDecay,
  computeStats,
  DEFAULT_PIN_BONUS,
  gravityScore,
  reactionScore,
  sedimentLayer,
  sedimentLevel,
  activityScore,
  noiseFactor,
  authorMassBonus,
} from "@/lib/domain/gravity";

describe("gravity", () => {
  test("reactionScore sums weighted reactions", () => {
    const score = reactionScore({
      like: 2,
      useful: 1,
      laugh: 0,
      tsukkomi: 0,
      agree: 0,
      heavy: 0,
    });
    expect(score).toBeCloseTo(3.5, 6);
  });

  test("ageDecay halves after one half-life", () => {
    const createdAt = 0;
    const now = 24 * 60 * 60 * 1000;
    expect(ageDecay(createdAt, now, 24)).toBeCloseTo(0.5, 6);
  });

  test("gravityScore adds pin bonus for pinned post", () => {
    const base = makePost({
      reactions: { like: 3, useful: 1, laugh: 0, tsukkomi: 0, agree: 0, heavy: 0 },
    });
    const pinned = { ...base, isPinned: true };
    const baseScore = gravityScore(base, { now: base.createdAt });
    const pinnedScore = gravityScore(pinned, { now: pinned.createdAt });
    expect(pinnedScore - baseScore).toBeCloseTo(DEFAULT_PIN_BONUS, 6);
  });

  test("gravityScore reflects author mass by identity mode", () => {
    const author: User = {
      id: "u1",
      name: "User One",
      isAnonymous: false,
      isBanned: false,
      createdAt: 0,
    };
    const named = makePost({ identityMode: "named" });
    const anon = makePost({ identityMode: "anonymous" });
    const namedScore = gravityScore(named, { now: named.createdAt, author });
    const anonScore = gravityScore(anon, { now: anon.createdAt, author });
    expect(namedScore).toBeGreaterThan(anonScore);
  });

  test("computeStats calculates conversation stats", () => {
    const events: GravityEvent[] = [
      { kind: "reaction", at: 1000, reaction: "like" },
      { kind: "reply", at: 2000 },
      { kind: "reaction", at: 3000, reaction: "useful" },
    ];
    
    const stats = computeStats(events);
    expect(stats).toEqual({
      replyCount: 1,
      reactionCounts: {
        like: 1,
        useful: 1,
        laugh: 0,
        tsukkomi: 0,
        agree: 0,
        heavy: 0,
      },
      maxActiveTime: 2000, // 3000 - 1000
    });
  });

  test("activityScore handles undefined stats", () => {
    const score = activityScore(undefined, { seed: 0 });
    expect(score).toBeCloseTo(0, 6);
  });

  test("noiseFactor correctly calculates noise factor", () => {
    // Test normal case
    expect(noiseFactor(10, 5)).toBeCloseTo(0.472, 3);
    
    // Test edge cases
    expect(noiseFactor(0, 5)).toBeCloseTo(0, 6);  // No reactions
    expect(noiseFactor(10, 0)).toBeCloseTo(1, 6); // No activity
  });

  test("authorMassBonus handles anonymous users", () => {
    const author = {
      id: "u1",
      name: "User One",
      isAnonymous: true,
      isBanned: false,
      createdAt: 0,
    };
    
    expect(authorMassBonus(author, { seed: 5 })).toBeCloseTo(0, 6);
  });

  test("authorMassBonus handles non-anonymous users", () => {
    const author = {
      id: "u1",
      name: "User One",
      isAnonymous: false,
      isBanned: false,
      createdAt: 0,
    };
    
    // This should return a positive value for non-anonymous users
    expect(authorMassBonus(author, { seed: 5 })).toBeGreaterThan(0);
  });

  test("sedimentLayer correctly calculates sediment layer", () => {
    const events: GravityEvent[] = [
      { kind: "reaction", at: 1000, reaction: "like" },
      { kind: "reply", at: 2000 },
      { kind: "reaction", at: 3000, reaction: "useful" },
    ];
    
    const layer = sedimentLayer(events);
    expect(layer).toBeCloseTo(1.5, 6); // Should be average of reply and reaction counts
  });

  test("sedimentLevel correctly calculates sediment level", () => {
    // Test with various gravity scores
    expect(sedimentLevel(0)).toBeCloseTo(0, 6);
    expect(sedimentLevel(100)).toBeCloseTo(3.78, 2); 
    expect(sedimentLevel(1000)).toBeCloseTo(5.49, 2);
  });
});

// Helper functions
type GravityEvent = {
  kind: "reaction" | "reply";
  at: number;
  reaction?: string;
};

type User = {
  id: string;
  name: string;
  isAnonymous: boolean;
  isBanned: boolean;
  createdAt: number;
};

const makePost = (overrides: Partial<{ identityMode: "named" | "anonymous"; reactions: any }>) => {
  return {
    identityMode: overrides.identityMode || "named",
    reactions: overrides.reactions || { like: 0, useful: 0, laugh: 0, tsukkomi: 0, agree: 0, heavy: 0 },
    createdAt: 0,
    isPinned: false,
  };
};
</ARG>