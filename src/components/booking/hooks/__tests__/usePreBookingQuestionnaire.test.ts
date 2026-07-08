import { renderHook, act } from '@testing-library/react-native';
import { usePreBookingQuestionnaire } from '../usePreBookingQuestionnaire';
import { supabase } from '../../../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useModal } from '../../../../contexts/ModalContext';

jest.mock('../../../../lib/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn().mockReturnThis(),
            upload: jest.fn(),
            getPublicUrl: jest.fn(),
        },
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn(),
    },
}));

jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../../../contexts/ModalContext', () => ({
    useModal: jest.fn(),
}));

describe('usePreBookingQuestionnaire', () => {
    const mockShowAlert = jest.fn();
    const mockOnClose = jest.fn();
    const mockOnSubmit = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useModal as jest.Mock).mockReturnValue({ showAlert: mockShowAlert });
    });

    it('uploads photos sequentially', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
            canceled: false,
            assets: [
                { base64: 'photo1base64' },
                { base64: 'photo2base64' },
            ],
        });

        (supabase.storage.upload as jest.Mock).mockResolvedValue({
            data: { path: 'test-path' },
            error: null,
        });

        (supabase.storage.getPublicUrl as jest.Mock).mockReturnValue({
            data: { publicUrl: 'http://test-url.com' },
        });

        const { result } = renderHook(() =>
            usePreBookingQuestionnaire({
                serviceId: 'service-1',
                masterId: 'master-1',
                onClose: mockOnClose,
                onSubmit: mockOnSubmit,
            })
        );

        await act(async () => {
            await result.current.pickPhotos();
        });

        expect(supabase.storage.upload).toHaveBeenCalledTimes(2);
        expect(result.current.formData.photos).toHaveLength(2);
    });
});
