/**
 * ClientDirectoryScreen — role guard + list/search/filter contract (T12).
 * Mirrors QrPaymentsScreen.test.tsx conventions (first screen suite in repo).
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ClientDirectoryScreen } from '../ClientDirectoryScreen';
import { useAuth } from '../../../contexts/AuthContext';
import * as svc from '../../../services/clientManagementService';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
    MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../../components/ui', () => {
    const RN = require('react-native');
    return {
        Card: ({ children }: any) => <>{children}</>,
        ScreenBackground: ({ children }: any) => <>{children}</>,
        MerakiText: ({ children, style }: any) => <RN.Text style={style}>{children}</RN.Text>,
    };
});

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => <>{children}</>,
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
    useFocusEffect: (cb: () => void) => {
        const React = require('react');
        React.useEffect(cb, []);
    },
}));

jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../../../services/clientManagementService', () => ({
    searchClients: jest.fn(),
    getClientDetail: jest.fn(),
    openConversationWith: jest.fn(),
    inviteWalkInClient: jest.fn(),
    addClientToPilatesSession: jest.fn(),
    addClientToBeautyAppointment: jest.fn(),
    CURRENT_WAIVER_TERMS_VERSION: '3.0',
}));

const searchMock = svc.searchClients as jest.Mock;

function asRole(role: 'owner' | 'master' | 'client') {
    (useAuth as jest.Mock).mockReturnValue({
        user: { id: `${role}-1` },
        profile: { id: `${role}-1`, role },
        role,
    });
}

const clientRow = { id: 'c1', full_name: 'Anna Client', email: 'anna@x.com', phone: null, avatar_url: null, role: 'client', created_at: null };
const masterRow = { id: 'm1', full_name: 'Mia Master', email: 'mia@x.com', phone: '555', avatar_url: null, role: 'master', created_at: null };

beforeEach(() => {
    jest.clearAllMocks();
    searchMock.mockResolvedValue({ data: [clientRow], error: null });
});

describe('ClientDirectoryScreen — permission gate', () => {
    it('non-owner (client) sees Restricted and never searches', () => {
        asRole('client');
        const screen = render(<ClientDirectoryScreen />);
        expect(screen.getByText('Restricted')).toBeTruthy();
        expect(screen.getByText(/owner only/)).toBeTruthy();
        expect(searchMock).not.toHaveBeenCalled();
    });

    it('owner sees searched rows with email', async () => {
        asRole('owner');
        const screen = render(<ClientDirectoryScreen />);
        await waitFor(() => expect(screen.getByText('Anna Client')).toBeTruthy(), { timeout: 1500 });
        expect(screen.getByText('anna@x.com')).toBeTruthy();
        expect(searchMock).toHaveBeenCalled();
    });
});

describe('ClientDirectoryScreen — interactions', () => {
    it('search input passes the query to the service', async () => {
        asRole('owner');
        const screen = render(<ClientDirectoryScreen />);
        await waitFor(() => expect(screen.getByText('Anna Client')).toBeTruthy(), { timeout: 1500 });
        fireEvent.changeText(screen.getByPlaceholderText(/Search name/), 'ann');
        await waitFor(() => expect(searchMock).toHaveBeenCalledWith('ann', 'clients'), { timeout: 1500 });
    });

    it('masters chip asks the service for role=masters', async () => {
        asRole('owner');
        searchMock.mockResolvedValue({ data: [masterRow], error: null });
        const screen = render(<ClientDirectoryScreen />);
        await waitFor(() => expect(searchMock).toHaveBeenCalled(), { timeout: 1500 });
        fireEvent.press(screen.getByText('Masters'));
        await waitFor(() => expect(searchMock).toHaveBeenCalledWith(expect.any(String), 'masters'), { timeout: 1500 });
    });

    it('client row navigates to ClientDetail with clientId', async () => {
        asRole('owner');
        const screen = render(<ClientDirectoryScreen />);
        await waitFor(() => expect(screen.getByText('Anna Client')).toBeTruthy(), { timeout: 1500 });
        fireEvent.press(screen.getByText('Anna Client'));
        expect(mockNavigate).toHaveBeenCalledWith('ClientDetail', { clientId: 'c1' });
    });

    it('master row navigates to MasterDetail with the master object', async () => {
        asRole('owner');
        searchMock.mockResolvedValue({ data: [masterRow], error: null });
        const screen = render(<ClientDirectoryScreen />);
        fireEvent.press(screen.getByText('Masters'));
        await waitFor(() => expect(screen.getByText('Mia Master')).toBeTruthy(), { timeout: 1500 });
        fireEvent.press(screen.getByText('Mia Master'));
        expect(mockNavigate).toHaveBeenCalledWith('MasterDetail', { master: masterRow });
    });
});

