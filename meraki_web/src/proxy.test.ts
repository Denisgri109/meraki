import { proxy } from './proxy';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

jest.mock('next/server', () => {
  return {
    NextResponse: {
      next: jest.fn((opts) => ({
        type: 'next',
        cookies: { set: jest.fn() },
        ...opts,
      })),
      redirect: jest.fn((url) => ({
        type: 'redirect',
        url: url.pathname,
      })),
    },
  };
});

const mockGetUser = jest.fn();

jest.mock('@supabase/ssr', () => {
  return {
    createServerClient: jest.fn(() => ({
      auth: {
        getUser: mockGetUser,
      },
    })),
  };
});

describe('proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  const createMockRequest = (pathname: string) => {
    return {
      cookies: {
        getAll: jest.fn(() => []),
        set: jest.fn(),
      },
      nextUrl: {
        pathname,
        clone: () => ({ pathname }),
      },
    } as unknown as NextRequest;
  };

  it('redirects unauthenticated users from dashboard to login', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = createMockRequest('/dashboard/settings');

    const response = await proxy(req);

    expect(mockGetUser).toHaveBeenCalled();
    expect(NextResponse.redirect).toHaveBeenCalled();
    expect(response).toEqual({ type: 'redirect', url: '/login' });
  });

  it('redirects authenticated users from login to dashboard', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: '123' } } });
    const req = createMockRequest('/login');

    const response = await proxy(req);

    expect(mockGetUser).toHaveBeenCalled();
    expect(NextResponse.redirect).toHaveBeenCalled();
    expect(response).toEqual({ type: 'redirect', url: '/dashboard' });
  });

  it('allows authenticated users to access dashboard', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: '123' } } });
    const req = createMockRequest('/dashboard/settings');

    const response = await proxy(req);

    expect(mockGetUser).toHaveBeenCalled();
    expect(response).toHaveProperty('type', 'next');
  });

  it('allows unauthenticated users to access other routes', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = createMockRequest('/');

    const response = await proxy(req);

    expect(mockGetUser).toHaveBeenCalled();
    expect(response).toHaveProperty('type', 'next');
  });

  it('creates Supabase client with cookie handlers', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = createMockRequest('/');

    await proxy(req);

    expect(createServerClient).toHaveBeenCalled();

    const clientOptions = jest.mocked(createServerClient).mock.calls[0][2];
    expect(clientOptions).toBeDefined();
    expect(clientOptions?.cookies?.getAll).toBeDefined();
    expect(clientOptions?.cookies?.setAll).toBeDefined();
  });
});
