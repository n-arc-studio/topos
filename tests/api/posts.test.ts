import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/posts/route";

// モック関数をvi.hoistedで事前に定義
const mocked = vi.hoisted(() => ({
  currentUser: vi.fn(),
  createPost: vi.fn(),
  persistStoreNow: vi.fn(),
  refreshStoreFromPersistence: vi.fn(),
}));

// モックの関数を設定
vi.mock("@/lib/session/identity", () => ({
  currentUser: mocked.currentUser,
}));

vi.mock("@/lib/infra/store", () => ({
  createPost: mocked.createPost,
  persistStoreNow: mocked.persistStoreNow,
  refreshStoreFromPersistence: mocked.refreshStoreFromPersistence,
}));

const mockCurrentUser = mocked.currentUser;
const mockCreatePost = mocked.createPost;
const mockPersistStoreNow = mocked.persistStoreNow;
const mockRefreshStoreFromPersistence = mocked.refreshStoreFromPersistence;

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
        identityMode: "anonymous",
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
      body: JSON.stringify({ body: "test post", identityMode: "anonymous" }),
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
      identityMode: "anonymous",
      authorId: "user123",
      createdAt: new Date().toISOString(),
    });
    mockPersistStoreNow.mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread123",
        body: "test post",
        identityMode: "anonymous",
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
        identityMode: "anonymous",
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
        identityMode: "anonymous",
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
