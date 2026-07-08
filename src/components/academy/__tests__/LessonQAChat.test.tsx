import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useLessonQA } from '../LessonQAChat';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useModal } from '../../../contexts/ModalContext';

// Mock vector icons completely to avoid TTF parsing errors
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

// Mock dependencies
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn()
    })),
    removeChannel: jest.fn(),
  }
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../../../contexts/ModalContext', () => ({
  useModal: jest.fn()
}));

const mockUser = { id: 'user-1' };
const mockProfile = { full_name: 'Test User' };
const mockShowAlert = jest.fn();

describe('useLessonQA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser, profile: mockProfile });
    (useModal as jest.Mock).mockReturnValue({ showAlert: mockShowAlert, showModal: jest.fn(), hideModal: jest.fn() });

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  it('should handle error when loading QA messages fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockError = new Error('Failed to fetch QA messages');

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: null, error: mockError }),
    });

    const props = {
      lessonId: 'lesson-1',
      courseId: 'course-1',
      instructorId: 'inst-1',
      isInstructor: false,
    };

    const { result } = renderHook(() => useLessonQA(props));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading QA messages:', mockError);
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Failed to fetch QA messages', 'error');

    consoleErrorSpy.mockRestore();
  });
});
