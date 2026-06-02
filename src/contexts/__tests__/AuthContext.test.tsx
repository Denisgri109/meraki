import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));

describe('AuthContext checkSession error handling', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('handles unexpected errors gracefully during checkSession', async () => {
    // 1. Setup mock to resolve normally for the initial load
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
        error: null
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for initial load to finish
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // We shouldn't have seen unexpected errors yet
    expect(consoleSpy).not.toHaveBeenCalledWith('Unexpected checkSession error:', expect.any(Error));

    // 2. Clear previous console calls (from expected initial log errors if any)
    consoleSpy.mockClear();

    // 3. Setup mock to throw when we explicitly call checkSession
    const error = new Error('Unexpected failure');
    (supabase.auth.getSession as jest.Mock).mockRejectedValueOnce(error);

    let isSuccess;
    await act(async () => {
      isSuccess = await result.current.checkSession();
    });

    expect(isSuccess).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Unexpected checkSession error:', error);
  });
});
