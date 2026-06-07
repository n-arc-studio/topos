import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/auth/route";

// モックのcurrentUser関数を設定
vi.mock("@/lib/session/identity", () => ({
  currentUser: vi.fn(),
}));

const mockCurrentUser = vi.mocked(
  await import("@/lib/session/identity").currentUser,
);

describe("GET /api/auth", () => {
  it("should return null user when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);

    const response = await GET();
    const result = await response.json();

    expect(result).toEqual({ user: null });
  });

  it("should return current user when authenticated", async () => {
    const mockUser = { id: "123", name: "Test User" };
    mockCurrentUser.mockResolvedValue(mockUser);

    const response = await GET();
    const result = await response.json();

    expect(result).toEqual(mockUser);
  });

  it("should handle errors in currentUser function", async () => {
    mockCurrentUser.mockRejectedValue(new Error("Authentication failed"));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
