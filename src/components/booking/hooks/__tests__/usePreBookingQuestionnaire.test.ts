import { renderHook, act } from '@testing-library/react-native';
import { usePreBookingQuestionnaire } from '../usePreBookingQuestionnaire';
import { supabase } from '../../../../lib/supabase';
import { useModal } from '../../../../contexts/ModalContext';

// Mocks
jest.mock('../../../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
        storage: {
            from: jest.fn(),
        },
    },
}));

jest.mock('../../../../contexts/ModalContext', () => ({
    useModal: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
}));

describe('usePreBookingQuestionnaire', () => {
    const mockShowAlert = jest.fn();
    const mockOnClose = jest.fn();
    const mockOnSubmit = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useModal as jest.Mock).mockReturnValue({ showAlert: mockShowAlert });
    });

    it('should handle submission error correctly', async () => {
        const mockError = new Error('Database error');

        // Setup initial formData
        const { result } = renderHook(() => usePreBookingQuestionnaire({
            serviceId: 'service-1',
            masterId: 'master-1',
            onClose: mockOnClose,
            onSubmit: mockOnSubmit,
        }));

        // Mock auth
        (supabase.auth.getUser as jest.Mock).mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });

        // Mock from().insert().select().single() to return error
        const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError });
        const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
        (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

        // Mock console.error to avoid noise in test output
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Make sure required fields are filled so we bypass validations
        await act(async () => {
            result.current.setFormData(prev => ({
                ...prev,
                photos: ['photo1.jpg'],
                hadBefore: false,
            }));
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error submitting consultation:', mockError);
        expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Database error', 'error');
        expect(mockOnSubmit).not.toHaveBeenCalled();
        expect(result.current.loading).toBe(false);

        consoleErrorSpy.mockRestore();
    });
});
