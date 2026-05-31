import { describe, expect, test } from "vitest";
import {
  ageDecay,
  computeStats,
  DEFAULT_PIN_BONUS,
  gravityScore,
  reactionScore,
  sedimentLayer,
} from "@/lib/domain/gravity";
import type { Post, User } from "@/lib/domain/types";

function makePost(partial: Partial<Post> = {}): Post {
  return {
    id: "p1",
    threadId: "t1",
    spaceId: "s1",
    authorId: "u1",
    identityMode: "named",
    body: "body",
    createdAt: 1_000,
    reactions: { like: 0, useful: 0, laugh: 0, tsukkomi: 0, agree: 0, heavy: 0 },
    isAdminPost: false,
    reportCount: 0,
    isPinned: false,
    isSunk: false,
    ...partial,
  };
}

describe("gravity", () => {
  test("reactionScore sums weighted reactions", () => {
    const score = reactionScore({
      like: 2,
      useful: 1,
      laugh: 1,
      tsukkomi: 0,
      agree: 3,
      heavy: 0,
    });
    expect(score).toBe(14.5);
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
      displayName: "user",
      isAdminOf: [],
      publicMass: 100,
      anonymousMass: 0,
    };
    const named = makePost({ identityMode: "named" });
    const anon = makePost({ identityMode: "anonymous" });
    const namedScore = gravityScore(named, { now: named.createdAt, author });
    const anonScore = gravityScore(anon, { now: anon.createdAt, author });
    expect(namedScore).toBeGreaterThan(anonScore);
  });

  test("computeStats counts descendants and unique participants", () => {
    const posts: Post[] = [
      makePost({ id: "root", authorId: "u1" }),
      makePost({ id: "c1", replyTo: "root", authorId: "u2" }),
      makePost({ id: "c2", replyTo: "c1", authorId: "u3" }),
      makePost({ id: "c3", replyTo: "root", authorId: "u2" }),
    ];
    const stats = computeStats(posts);
    expect(stats.replyCountByPost.root).toBe(2);
    expect(stats.participantsByPost.root).toBe(2);
  });

  test("sedimentLayer threshold mapping", () => {
    expect(sedimentLayer(0.1)).toBe("surface");
    expect(sedimentLayer(0.4)).toBe("shallow");
    expect(sedimentLayer(0.7)).toBe("deep");
    expect(sedimentLayer(0.9)).toBe("abyss");
  });
});
