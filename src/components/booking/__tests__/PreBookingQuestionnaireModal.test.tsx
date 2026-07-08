import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PreBookingQuestionnaireModal } from '../PreBookingQuestionnaireModal';
import { useModal } from '../../../contexts/ModalContext';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';

// Mock contexts and hooks
jest.mock('../../../contexts/ModalContext', () => ({
    useModal: jest.fn(),
}));

jest.mock('../../../lib/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn(),
        },
    },
}));

jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-blur', () => {
    const ReactMock = require('react');
    return {
        BlurView: class extends ReactMock.Component {
            render() {
                return ReactMock.createElement('View', this.props, this.props.children);
            }
        }
    };
});

jest.mock('../../../components/ui', () => ({
    Button: ({ title, onPress, disabled, loading }: any) => {
        const { TouchableOpacity, Text } = require('react-native');
        return (
            <TouchableOpacity onPress={onPress} disabled={disabled || loading} testID="button">
                <Text>{title}</Text>
            </TouchableOpacity>
        );
    },
}));

jest.mock('react-native', () => {
    const rn = jest.requireActual('react-native');
    const ReactMock = require('react');
    const mockOverrides = {
        Modal: class extends ReactMock.Component {
            render() {
                return ReactMock.createElement('View', this.props, this.props.children);
            }
        },
        ActivityIndicator: class extends ReactMock.Component {
            render() {
                return ReactMock.createElement('View', this.props, this.props.children);
            }
        },
        Text: class extends ReactMock.Component {
            render() {
                return ReactMock.createElement('Text', this.props, this.props.children);
            }
        },
        TouchableOpacity: class extends ReactMock.Component {
            render() {
                return ReactMock.createElement('TouchableOpacity', this.props, this.props.children);
            }
        },
        ScrollView: class extends ReactMock.Component {
            render() {
                return ReactMock.createElement('ScrollView', this.props, this.props.children);
            }
        },
        TextInput: class extends ReactMock.Component {
            render() {
                return ReactMock.createElement('TextInput', this.props, this.props.children);
            }
        },
        Image: class extends ReactMock.Component {
            render() {
                return ReactMock.createElement('Image', this.props, this.props.children);
            }
        }
    };
    return Object.setPrototypeOf(mockOverrides, rn);
});

describe('PreBookingQuestionnaireModal', () => {
    const mockShowAlert = jest.fn();
    const mockOnClose = jest.fn();
    const mockOnSubmit = jest.fn();
    const defaultProps = {
        visible: true,
        onClose: mockOnClose,
        onSubmit: mockOnSubmit,
        serviceId: 'service-1',
        serviceName: 'Test Service',
        masterId: 'master-1',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (useModal as jest.Mock).mockReturnValue({ showAlert: mockShowAlert });
    });

    it('should handle photo upload errors correctly', async () => {
        // Setup console.error mock
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock ImagePicker to return an image
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
            canceled: false,
            assets: [{ base64: 'mock-base64', uri: 'mock-uri' }],
        });

        // Mock Supabase to fail on upload
        const mockUploadError = new Error('Upload failed');
        (supabase.storage.from as jest.Mock).mockReturnValueOnce({
            upload: jest.fn().mockResolvedValueOnce({ error: mockUploadError }),
        });

        const { getByText } = render(<PreBookingQuestionnaireModal {...defaultProps} />);

        // Press the "Add Photos" button - uses Regex because it's multiple elements inside TouchableOpacity
        const addPhotosButton = getByText(/Add Photos/);
        fireEvent.press(addPhotosButton);

        // Wait for error handling
        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error uploading photos:', mockUploadError);
            expect(mockShowAlert).toHaveBeenCalledWith(
                'Error',
                'Failed to upload photos. Please try again.',
                'error'
            );
        });

        consoleErrorSpy.mockRestore();
    });
});
