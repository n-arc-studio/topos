import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/posts/route";

// モックの関数を設定
vi.mock("@/lib/session/identity", () => ({
  currentUser: vi.fn(),
}));

vi.mock("@/lib/infra/store", () => ({
  createPost: vi.fn(),
  persistStoreNow: vi.fn(),
  refreshStoreFromPersistence: vi.fn(),
}));

const mockCurrentUser = vi.mocked(
  await import("@/lib/session/identity").currentUser,
);
const mockCreatePost = vi.mocked(await import("@/lib/infra/store").createPost);
const mockPersistStoreNow = vi.mocked(
  await import("@/lib/infra/store").persistStoreNow,
);
const mockRefreshStoreFromPersistence = vi.mocked(
  await import("@/lib/infra/store").refreshStoreFromPersistence,
);

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread123",
        body: "test post",
        identityMode: "public",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should return 400 when required fields are missing", async () => {
    mockCurrentUser.mockResolvedValue({ id: "user123", name: "Test User" });

    // threadIdが不足
    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      body: JSON.stringify({ body: "test post", identityMode: "public" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should create post successfully when all fields are valid", async () => {
    mockCurrentUser.mockResolvedValue({ id: "user123", name: "Test User" });
    mockRefreshStoreFromPersistence.mockResolvedValue(undefined);
    mockCreatePost.mockReturnValue({
      id: "post456",
      threadId: "thread123",
      body: "test post",
      identityMode: "public",
      authorId: "user123",
      createdAt: new Date().toISOString(),
    });
    mockPersistStoreNow.mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread123",
        body: "test post",
        identityMode: "public",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("should handle createPost errors properly", async () => {
    mockCurrentUser.mockResolvedValue({ id: "user123", name: "Test User" });
    mockRefreshStoreFromPersistence.mockResolvedValue(undefined);
    mockCreatePost.mockReturnValue({
      error: "invalid_thread_id",
    });

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread123",
        body: "test post",
        identityMode: "public",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should handle store errors properly", async () => {
    mockCurrentUser.mockResolvedValue({ id: "user123", name: "Test User" });
    mockRefreshStoreFromPersistence.mockRejectedValue(new Error("store error"));

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread123",
        body: "test post",
        identityMode: "public",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it("should handle invalid identity mode properly", async () => {
    mockCurrentUser.mockResolvedValue({ id: "user123", name: "Test User" });

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread123",
        body: "test post",
        identityMode: "invalid_mode",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
