import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useLessonQA } from '../LessonQAChat';
import * as ImagePicker from 'expo-image-picker';

// Mock vector icons completely so we avoid font loading errors.
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Ionicons: 'Ionicons',
  FontAwesome: 'FontAwesome',
}));

// Mock contexts
jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id' },
        profile: { id: 'test-user-id' }
    })
}));

const mockShowAlert = jest.fn();
const mockShowModal = jest.fn();
const mockHideModal = jest.fn();

jest.mock('../../../contexts/ModalContext', () => ({
    useModal: () => ({
        showAlert: mockShowAlert,
        showModal: mockShowModal,
        hideModal: mockHideModal
    })
}));

jest.mock('../../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
        channel: jest.fn(() => ({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn()
        })),
        removeChannel: jest.fn()
    }
}));

jest.mock('expo-image-picker', () => ({
    requestCameraPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn()
}));

// A test component to run the hook
function HookWrapper({ hookArgs, onHookReady }: { hookArgs: any, onHookReady: (hookReturn: any) => void }) {
    const hookReturn = useLessonQA(hookArgs);

    React.useEffect(() => {
        onHookReady(hookReturn);
    }, [hookReturn, onHookReady]);

    return null; // Return null so we don't render RN components that are throwing errors in Jest
}

// Suppress console.error in tests to avoid messy output from intended errors
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});
afterAll(() => {
    console.error = originalConsoleError;
});
beforeEach(() => {
    jest.clearAllMocks();
});

describe('useLessonQA Hook Image Error Handling', () => {
    it('shows an alert when pickImage throws an error', async () => {
        const error = new Error('Simulated image picker error');
        (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockRejectedValue(error);

        let currentHookReturn: any;

        render(
            <HookWrapper
                hookArgs={{ lessonId: "test", courseId: "test", isInstructor: false, instructorId: "inst" }}
                onHookReady={(ret) => { currentHookReturn = ret; }}
            />
        );

        await act(async () => {
            await currentHookReturn.pickImage();
        });

        expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('Image picker error:', error);
        expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Simulated image picker error', 'error');
    });

    it('shows an alert when takePhoto throws an error', async () => {
        const error = new Error('Simulated camera error');
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockRejectedValue(error);

        let currentHookReturn: any;

        render(
            <HookWrapper
                hookArgs={{ lessonId: "test", courseId: "test", isInstructor: false, instructorId: "inst" }}
                onHookReady={(ret) => { currentHookReturn = ret; }}
            />
        );

        await act(async () => {
            await currentHookReturn.takePhoto();
        });

        expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('Camera error:', error);
        expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Simulated camera error', 'error');
    });
});
