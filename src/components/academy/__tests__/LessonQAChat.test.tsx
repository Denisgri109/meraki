import { renderHook, act } from '@testing-library/react-native';
import { useLessonQA } from '../LessonQAChat';
import * as ImagePicker from 'expo-image-picker';

const mockShowAlert = jest.fn();

jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'test-user' }, profile: { full_name: 'Test User' } })
}));

jest.mock('../../../contexts/ModalContext', () => ({
    useModal: () => ({ showAlert: mockShowAlert, showModal: jest.fn(), hideModal: jest.fn() })
}));

const mockSupabaseEq = jest.fn();
const mockSupabaseOrder = jest.fn();
const mockSupabaseUpdate = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseInsert = jest.fn();

const mockFromObj = {
    select: mockSupabaseSelect,
    eq: mockSupabaseEq,
    order: mockSupabaseOrder,
    update: mockSupabaseUpdate,
    insert: mockSupabaseInsert
};

jest.mock('../../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => mockFromObj),
        channel: jest.fn().mockReturnValue({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
        }),
        removeChannel: jest.fn()
    }
}));

jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn()
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
    MaterialCommunityIcons: 'MaterialCommunityIcons'
}));

describe('useLessonQA Error Handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default chain for loadMessages
        mockSupabaseSelect.mockReturnValue(mockFromObj);
        mockSupabaseEq.mockReturnValue(mockFromObj);
        mockSupabaseOrder.mockResolvedValue({ data: [], error: null });
        mockSupabaseUpdate.mockReturnValue(mockFromObj);
        mockSupabaseInsert.mockResolvedValue({ error: null });
    });

    it('handles image picker throwing an error by logging the error to console', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('Picker failed');
        (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockRejectedValueOnce(error);

        const { result } = renderHook(() => useLessonQA({ lessonId: 'l1', courseId: 'c1', instructorId: 'i1', isInstructor: false }));

        await act(async () => {
            await result.current.pickImage();
        });

        expect(consoleSpy).toHaveBeenCalledWith('Image picker error:', error);
        consoleSpy.mockRestore();
    });

    it('handles camera throwing an error by logging the error to console', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('Camera failed');
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockRejectedValueOnce(error);

        const { result } = renderHook(() => useLessonQA({ lessonId: 'l1', courseId: 'c1', instructorId: 'i1', isInstructor: false }));

        await act(async () => {
            await result.current.takePhoto();
        });

        expect(consoleSpy).toHaveBeenCalledWith('Camera error:', error);
        consoleSpy.mockRestore();
    });

    it('handles image upload throwing an error by showing an alert', async () => {
        const mockAsset = { base64: 'mock-base-64-string', uri: 'file://mock-image.jpg' } as ImagePicker.ImagePickerAsset;

        (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [mockAsset] });

        const { supabase } = require('../../../lib/supabase');

        const mockUpload = jest.fn().mockRejectedValueOnce(new Error('Upload completely failed'));
        supabase.storage = {
            from: jest.fn().mockReturnValue({
                upload: mockUpload
            })
        };

        const { result } = renderHook(() => useLessonQA({ lessonId: 'l1', courseId: 'c1', instructorId: 'i1', isInstructor: false }));

        await act(async () => {
            await result.current.pickImage();
        });

        expect(mockShowAlert).toHaveBeenCalledWith('Upload Failed', 'Upload completely failed', 'error');
    });

    it('handles toggle pin throwing an error by logging the error to console', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('Pin failed');

        // First eq call is from loadMessages, second is from togglePin
        mockSupabaseEq.mockReturnValueOnce(mockFromObj).mockRejectedValueOnce(error);

        const { result } = renderHook(() => useLessonQA({ lessonId: 'l1', courseId: 'c1', instructorId: 'i1', isInstructor: true }));

        await act(async () => {
            await result.current.togglePin('msg-1', false);
        });

        expect(consoleSpy).toHaveBeenCalledWith('Toggle pin error:', error);
        consoleSpy.mockRestore();
    });

    it('handles sendMessage throwing an error by showing an alert', async () => {
        const error = new Error('Send completely failed');
        mockSupabaseInsert.mockResolvedValueOnce({ error });

        const { result } = renderHook(() => useLessonQA({ lessonId: 'l1', courseId: 'c1', instructorId: 'i1', isInstructor: false }));

        await act(async () => {
            await result.current.sendMessage('test content', null, null);
        });

        expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Send completely failed', 'error');
    });

    it('handles loadMessages throwing an error by logging the error to console', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('Load failed');

        // Note: loadMessages is called in useEffect on mount, but we simulate the failure.
        mockSupabaseSelect.mockReturnValueOnce(mockFromObj);
        mockSupabaseEq.mockReturnValueOnce(mockFromObj);
        mockSupabaseOrder.mockRejectedValueOnce(error);

        renderHook(() => useLessonQA({ lessonId: 'l1', courseId: 'c1', instructorId: 'i1', isInstructor: false }));

        // wait for async effect
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
        });

        expect(consoleSpy).toHaveBeenCalledWith('Error loading QA messages:', error);
        consoleSpy.mockRestore();
    });
});
