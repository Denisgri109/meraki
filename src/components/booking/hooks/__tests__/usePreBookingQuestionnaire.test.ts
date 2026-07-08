import { renderHook, act } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { usePreBookingQuestionnaire } from '../usePreBookingQuestionnaire';
import { supabase } from '../../../../lib/supabase';
import { useModal } from '../../../../contexts/ModalContext';

jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../../../lib/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn(),
        },
        auth: {
            getUser: jest.fn(),
        },
    },
}));

jest.mock('../../../../contexts/ModalContext', () => ({
    useModal: jest.fn(),
}));

jest.mock('uuid', () => ({
    v4: () => 'mock-uuid',
}));

describe('usePreBookingQuestionnaire', () => {
    const mockShowAlert = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useModal as jest.Mock).mockReturnValue({ showAlert: mockShowAlert });
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should handle error during photo upload', async () => {
        // Setup mock image picker response
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
            canceled: false,
            assets: [
                {
                    base64: 'mock-base64-data',
                    uri: 'file://test.jpg',
                }
            ],
        });

        // Setup mock supabase storage to return an error
        const mockUpload = jest.fn().mockResolvedValue({
            error: new Error('Storage error'),
        });

        (supabase.storage.from as jest.Mock).mockReturnValue({
            upload: mockUpload,
        });

        const { result } = renderHook(() => usePreBookingQuestionnaire({
            serviceId: '123',
            masterId: '456',
            onClose: jest.fn(),
            onSubmit: jest.fn(),
        }));

        await act(async () => {
            await result.current.pickPhotos();
        });

        // Verify that the error was logged
        expect(console.error).toHaveBeenCalledWith(
            'Error uploading photos:',
            expect.any(Error)
        );

        // Verify that the alert was shown to the user
        expect(mockShowAlert).toHaveBeenCalledWith(
            'Error',
            'Failed to upload photos. Please try again.',
            'error'
        );

        // Verify uploading state is reset
        expect(result.current.uploadingPhotos).toBe(false);
    });
});
