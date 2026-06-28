import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/threads/route';

// モック関数をvi.hoistedで事前に定義
const mocked = vi.hoisted(() => ({
  currentUser: vi.fn(),
  createThread: vi.fn(),
  persistStoreNow: vi.fn(),
  refreshStoreFromPersistence: vi.fn(),
}));

// モックの関数を設定
vi.mock('@/lib/session/identity', () => ({
  currentUser: mocked.currentUser,
}));

vi.mock('@/lib/infra/store', () => ({
  createThread: mocked.createThread,
  persistStoreNow: mocked.persistStoreNow,
  refreshStoreFromPersistence: mocked.refreshStoreFromPersistence,
}));

const mockCurrentUser = mocked.currentUser;
const mockCreateThread = mocked.createThread;
const mockPersistStoreNow = mocked.persistStoreNow;
const mockRefreshStoreFromPersistence = mocked.refreshStoreFromPersistence;

describe('POST /api/threads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockCurrentUser.mockResolvedValue(null);
    
    const request = new Request('http://localhost:3000/api/threads', {
      method: 'POST',
      body: JSON.stringify({ title: 'test thread' }),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 when required fields are missing', async () => {
    mockCurrentUser.mockResolvedValue({ id: 'user123', name: 'Test User' });
    
    // titleが不足
    const request = new Request('http://localhost:3000/api/threads', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should create thread successfully when all fields are valid', async () => {
    mockCurrentUser.mockResolvedValue({ id: 'user123', name: 'Test User' });
    mockRefreshStoreFromPersistence.mockResolvedValue(undefined);
    mockCreateThread.mockReturnValue({
      id: 'thread456',
      title: 'test thread',
      authorId: 'user123',
      createdAt: new Date().toISOString(),
    });
    mockPersistStoreNow.mockResolvedValue(undefined);

    const request = new Request('http://localhost:3000/api/threads', {
      method: 'POST',
      body: JSON.stringify({ spaceId: 'space123', title: 'test thread' }),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('should handle createThread errors properly', async () => {
    mockCurrentUser.mockResolvedValue({ id: 'user123', name: 'Test User' });
    mockRefreshStoreFromPersistence.mockResolvedValue(undefined);
    mockCreateThread.mockReturnValue({
      error: 'invalid_title',
    });
    
    const request = new Request('http://localhost:3000/api/threads', {
      method: 'POST',
      body: JSON.stringify({ title: 'test thread' }),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle store errors properly', async () => {
    mockCurrentUser.mockResolvedValue({ id: 'user123', name: 'Test User' });
    mockRefreshStoreFromPersistence.mockRejectedValue(new Error('store error'));

    const request = new Request('http://localhost:3000/api/threads', {
      method: 'POST',
      body: JSON.stringify({ spaceId: 'space123', title: 'test thread' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});