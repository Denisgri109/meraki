import { renderHook, act } from '@testing-library/react-native';
import { useLessonQA } from '../LessonQAChat';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useModal } from '../../../contexts/ModalContext';

jest.mock('../../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({ data: [], error: null })
                })
            }),
            order: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
            }),
        })),
        channel: jest.fn(() => ({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
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

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
    MaterialCommunityIcons: 'MaterialCommunityIcons'
}));

jest.mock('expo-image-picker', () => ({}));
jest.mock('base64-arraybuffer', () => ({}));
jest.mock('../../../components/ui', () => ({
    MerakiText: 'MerakiText',
    Card: 'Card'
}));

describe('useLessonQA', () => {
    const mockShowAlert = jest.fn();
    const mockShowModal = jest.fn();
    const mockHideModal = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        (useAuth as jest.Mock).mockReturnValue({
            user: { id: 'user1' },
            profile: { id: 'user1', role: 'owner' }
        });

        (useModal as jest.Mock).mockReturnValue({
            showAlert: mockShowAlert,
            showModal: mockShowModal,
            hideModal: mockHideModal
        });

        // Mock default supabase query resolution
        (supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({ data: [], error: null })
                })
            }),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null })
        })
        });
    });

    it('should show error alert if togglePin fails', async () => {
        const mockError = new Error('Database error');

        (supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({ data: [], error: null })
                })
            }),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ error: mockError })
        });

        const { result } = renderHook(() => useLessonQA({
            lessonId: 'l1',
            courseId: 'c1',
            instructorId: 'i1',
            isInstructor: true
        }));

        await act(async () => {
            await result.current.togglePin('msg1', false);
        });

        expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Database error', 'error');
    });
});
