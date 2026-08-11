/**
 * Owner-only visual editing — component gating tests.
 *
 * The security-critical invariant is that clients and masters never see an
 * edit affordance and can never open an editor, on top of the owner-only RLS
 * policy on `global_settings`.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { EditableText } from '../editable/EditableText';
import { EditToolbar } from '../editable/EditToolbar';
import { useEditMode } from '../../contexts/EditContext';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../contexts/EditContext', () => ({
    useEditMode: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
}));

const useEditModeMock = useEditMode as unknown as jest.Mock;

const updateContent = jest.fn();
const clearContent = jest.fn();
const setEditMode = jest.fn();
const setClientView = jest.fn();

function mockEditState(overrides: Record<string, unknown> = {}) {
    useEditModeMock.mockReturnValue({
        isEditMode: false,
        canEdit: false,
        isOwner: false,
        isClientView: false,
        loading: false,
        content: {},
        getContent: (_key: string, fallback: string) => fallback,
        updateContent,
        clearContent,
        setEditMode,
        setClientView,
        toggleEditMode: jest.fn(),
        refreshContent: jest.fn(),
        resetContent: jest.fn(),
        ...overrides,
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    updateContent.mockResolvedValue({ error: null });
    clearContent.mockResolvedValue({ error: null });
});

describe('EditableText', () => {
    it('renders the registry fallback when no override is saved', () => {
        mockEditState();
        const { getByText } = render(<EditableText contentKey="mobile.home.hero_button" />);
        expect(getByText('Shop Now')).toBeTruthy();
    });

    it('renders the saved override in place of the fallback', () => {
        mockEditState({
            getContent: (key: string) => (key === 'mobile.home.hero_button' ? 'Buy Now' : ''),
        });
        const { getByText } = render(<EditableText contentKey="mobile.home.hero_button" />);
        expect(getByText('Buy Now')).toBeTruthy();
    });

    it('gives a client no way to open the editor', () => {
        mockEditState({ canEdit: false, isEditMode: true });
        const { getByText, queryByLabelText } = render(
            <EditableText contentKey="mobile.home.hero_button" label="Hero Button Label" />
        );

        expect(queryByLabelText('Edit Hero Button Label')).toBeNull();
        fireEvent.press(getByText('Shop Now'));
        expect(updateContent).not.toHaveBeenCalled();
    });

    it('gives an owner no editor while edit mode is off', () => {
        mockEditState({ canEdit: true, isOwner: true, isEditMode: false });
        const { queryByLabelText } = render(
            <EditableText contentKey="mobile.home.hero_button" label="Hero Button Label" />
        );
        expect(queryByLabelText('Edit Hero Button Label')).toBeNull();
    });

    it('lets an owner in edit mode save new copy', async () => {
        mockEditState({ canEdit: true, isOwner: true, isEditMode: true });
        const { getByLabelText, getByDisplayValue, getByText } = render(
            <EditableText contentKey="mobile.home.hero_button" label="Hero Button Label" />
        );

        fireEvent.press(getByLabelText('Edit Hero Button Label'));

        const input = getByDisplayValue('Shop Now');
        fireEvent.changeText(input, 'Browse Products');
        fireEvent.press(getByText('Save'));

        await waitFor(() =>
            expect(updateContent).toHaveBeenCalledWith('mobile.home.hero_button', 'Browse Products')
        );
    });

    it('offers "restore original" only once the copy has been customised', () => {
        mockEditState({ canEdit: true, isOwner: true, isEditMode: true });
        const plain = render(
            <EditableText contentKey="mobile.home.hero_button" label="Hero Button Label" />
        );
        fireEvent.press(plain.getByLabelText('Edit Hero Button Label'));
        expect(plain.queryByText('Restore original text')).toBeNull();

        mockEditState({
            canEdit: true,
            isOwner: true,
            isEditMode: true,
            getContent: () => 'Buy Now',
        });
        const custom = render(
            <EditableText contentKey="mobile.home.hero_button" label="Hero Button Label" />
        );
        fireEvent.press(custom.getByLabelText('Edit Hero Button Label'));
        expect(custom.getByText('Restore original text')).toBeTruthy();
    });

    it('keeps the editor open and surfaces the message when the save is rejected', async () => {
        updateContent.mockResolvedValue({ error: 'Only owners can edit content' });
        mockEditState({ canEdit: true, isOwner: true, isEditMode: true });
        const { getByLabelText, getByText } = render(
            <EditableText contentKey="mobile.home.hero_button" label="Hero Button Label" />
        );

        fireEvent.press(getByLabelText('Edit Hero Button Label'));
        fireEvent.press(getByText('Save'));

        await waitFor(() => expect(getByText('Only owners can edit content')).toBeTruthy());
    });
});

describe('EditToolbar', () => {
    it('renders nothing for non-owners', () => {
        mockEditState({ canEdit: false, isEditMode: true, isClientView: true });
        const { toJSON } = render(<EditToolbar />);
        expect(toJSON()).toBeNull();
    });

    it('renders nothing for an idle owner', () => {
        mockEditState({ canEdit: true, isOwner: true });
        const { toJSON } = render(<EditToolbar />);
        expect(toJSON()).toBeNull();
    });

    it('offers Customize and Client View while an owner is editing', () => {
        mockEditState({ canEdit: true, isOwner: true, isEditMode: true });
        const { getByText } = render(<EditToolbar />);

        expect(getByText('Editing')).toBeTruthy();
        fireEvent.press(getByText('Customize'));
        expect(mockNavigate).toHaveBeenCalledWith('OwnerApp', {
            screen: 'Menu',
            params: { screen: 'CustomizeApp' },
        });

        fireEvent.press(getByText('Client View'));
        expect(setClientView).toHaveBeenCalledWith(true);
    });

    it('exits both edit mode and client view from Client View', () => {
        mockEditState({ canEdit: true, isOwner: true, isEditMode: true, isClientView: true });
        const { getByText } = render(<EditToolbar />);

        expect(getByText('Client View')).toBeTruthy();
        fireEvent.press(getByText('Exit'));
        expect(setEditMode).toHaveBeenCalledWith(false);
        expect(setClientView).toHaveBeenCalledWith(false);
    });
});
