import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { PreBookingQuestionnaireModal } from '../PreBookingQuestionnaireModal';
import { supabase } from '../../../lib/supabase';
import { useModal } from '../../../contexts/ModalContext';

// Fix for react-native Modal mocking
jest.mock('react-native', () => {
    const React = require('react');
    const RN = jest.requireActual('react-native');

    class MockComponent extends React.Component {
        render() { return React.createElement('View', this.props, this.props.children); }
    }

    return Object.setPrototypeOf({
        Modal: MockComponent,
        ActivityIndicator: MockComponent,
        Text: class extends React.Component {
            render() { return React.createElement('Text', this.props, this.props.children); }
        },
        TextInput: class extends React.Component {
            render() { return React.createElement('TextInput', this.props, this.props.children); }
        },
        TouchableOpacity: class extends React.Component {
            render() { return React.createElement('View', this.props, this.props.children); }
        },
        ScrollView: class extends React.Component {
            render() { return React.createElement('View', this.props, this.props.children); }
        },
        Image: class extends React.Component {
            render() { return React.createElement('Image', this.props, this.props.children); }
        }
    }, RN);
});


// Mock contexts
jest.mock('../../../contexts/ModalContext', () => ({
    useModal: jest.fn(),
}));

// Mock supabase
jest.mock('../../../lib/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn().mockReturnValue({
                upload: jest.fn().mockResolvedValue({ data: { path: 'test/path.jpg' }, error: null }),
                getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test/path.jpg' } })
            })
        },
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
    },
}));

// Mock BlurView
jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

// Mock ImagePicker
jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
    MediaTypeOptions: { Images: 'Images' },
}));

describe('PreBookingQuestionnaireModal', () => {
    const mockShowAlert = jest.fn();
    const mockOnClose = jest.fn();
    const mockOnSubmit = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useModal as jest.Mock).mockReturnValue({ showAlert: mockShowAlert });
        console.error = jest.fn();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('handles submission error when supabase insert fails', async () => {
        // Setup mock user
        (supabase.auth.getUser as jest.Mock).mockResolvedValue({
            data: { user: { id: 'user-123' } },
        });

        // Setup mock database insert failure
        const mockError = new Error('Database error');
        const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError });
        const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
        (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

        const { getByText, getByPlaceholderText } = render(
            <PreBookingQuestionnaireModal
                visible={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                serviceId="service-123"
                serviceName="Test Service"
                masterId="master-123"
            />
        );

        // Fill out form minimally to pass validation
        const noButton = getByText('No');
        fireEvent.press(noButton);

        // Mock image picker to add a photo to pass validation
        const ImagePicker = require('expo-image-picker');
        ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'file://test.jpg', base64: 'mock-base64' }],
        });

        const uploadButton = getByText(/Add Photos/);
        await act(async () => {
            fireEvent.press(uploadButton);
        });

        // Submit form
        const submitButton = getByText('Submit for Review');
        await act(async () => {
            fireEvent.press(submitButton);
        });

        // Verify error handling
        await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith('Error submitting consultation:', mockError);
            expect(mockShowAlert).toHaveBeenCalledWith(
                'Error',
                'Database error',
                'error'
            );
        });
    });
});
