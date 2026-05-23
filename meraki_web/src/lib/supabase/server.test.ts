import { createClient } from './server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Mock the dependencies
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

describe('Supabase Server Client', () => {
  const mockSet = jest.fn();
  const mockGetAll = jest.fn();

  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    };

    (cookies as jest.Mock).mockResolvedValue({
      getAll: mockGetAll,
      set: mockSet,
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should initialize the server client with correct credentials', async () => {
    await createClient();

    expect(cookies).toHaveBeenCalledTimes(1);
    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(createServerClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        cookies: expect.any(Object),
      })
    );
  });

  describe('cookies implementation', () => {
    it('getAll should return cookies from the store', async () => {
      const mockCookies = [{ name: 'test', value: 'value' }];
      mockGetAll.mockReturnValue(mockCookies);

      await createClient();

      // Extract the cookies config passed to createServerClient
      const optionsArg = (createServerClient as jest.Mock).mock.calls[0][2];
      const result = optionsArg.cookies.getAll();

      expect(mockGetAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockCookies);
    });

    it('setAll should correctly set each cookie', async () => {
      await createClient();

      const optionsArg = (createServerClient as jest.Mock).mock.calls[0][2];

      const cookiesToSet = [
        { name: 'cookie1', value: 'value1', options: { secure: true } },
        { name: 'cookie2', value: 'value2', options: { path: '/' } },
      ];

      optionsArg.cookies.setAll(cookiesToSet);

      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenNthCalledWith(1, 'cookie1', 'value1', { secure: true });
      expect(mockSet).toHaveBeenNthCalledWith(2, 'cookie2', 'value2', { path: '/' });
    });

    it('setAll should safely ignore errors when calling set (e.g., in Server Components)', async () => {
      // Mock cookieStore.set to throw an error
      mockSet.mockImplementation(() => {
        throw new Error('Cannot set cookies in Server Component');
      });

      await createClient();

      const optionsArg = (createServerClient as jest.Mock).mock.calls[0][2];

      const cookiesToSet = [
        { name: 'cookie1', value: 'value1', options: {} }
      ];

      // This should not throw
      expect(() => {
        optionsArg.cookies.setAll(cookiesToSet);
      }).not.toThrow();

      expect(mockSet).toHaveBeenCalledTimes(1);
    });
  });
});
