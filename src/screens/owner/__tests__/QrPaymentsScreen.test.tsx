/**
 * QrPaymentsScreen — Tier 2 screen test (first screen-level suite in the repo).
 *
 * Role-aware rendering contract:
 *  - owner: sees all codes + Add/Edit/Hide/Delete controls
 *  - master with can_view_qr_pay: read-only list, no owner controls
 *  - master WITHOUT can_view_qr_pay: hard "Restricted" guard, no data fetch
 *  - payload-only code renders via QRCode, image-only code via Image,
 *    code with NEITHER renders the qr-fallback icon
 *  - fullscreen presentation overlay opens on tap
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QrPaymentsScreen } from '../QrPaymentsScreen';
import { useAuth } from '../../../contexts/AuthContext';
import { useModal } from '../../../contexts/ModalContext';
import * as qrPay from '../../../services/qrPayService';
import { mockQrPayCode } from '../../../__mocks__/merakiData';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
    MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('../../../components/ui', () => ({
    Card: ({ children }: any) => <>{children}</>,
    ScreenBackground: ({ children }: any) => <>{children}</>,
}));

jest.mock('../../../components/ImageUrlUpload', () => ({
    ImageUrlUpload: 'ImageUrlUpload',
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => <>{children}</>,
}));

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
    useFocusEffect: (cb: () => void) => {
        const React = require('react');
        React.useEffect(cb, []);
    },
}));

jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../contexts/ModalContext', () => ({ useModal: jest.fn() }));
jest.mock('../../../services/qrPayService', () => ({
    listQrPayCodes: jest.fn(),
    createQrPayCode: jest.fn(),
    updateQrPayCode: jest.fn(),
    deleteQrPayCode: jest.fn(),
}));

const showAlertMock = jest.fn();
const listMock = qrPay.listQrPayCodes as jest.Mock;

function asRole(role: 'owner' | 'master' | 'client', canViewQrPay = false) {
    (useAuth as jest.Mock).mockReturnValue({
        user: { id: `${role}-1` },
        profile: { id: `${role}-1`, can_view_qr_pay: canViewQrPay, role },
        role,
    });
    (useModal as jest.Mock).mockReturnValue({ showAlert: showAlertMock });
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('QrPaymentsScreen — permission gate', () => {
    it('master without can_view_qr_pay sees Restricted and NO data is fetched', async () => {
        asRole('master', false);
        const screen = render(<QrPaymentsScreen />);
        expect(screen.getByText('Restricted')).toBeTruthy();
        expect(screen.getByText(/only available to the owner and authorized instructors/)).toBeTruthy();
        expect(listMock).not.toHaveBeenCalled();
    });

    it('master WITH can_view_qr_pay receives the instructor view (read-only)', async () => {
        asRole('master', true);
        listMock.mockResolvedValue([mockQrPayCode({ provider_name: 'Revolut' })]);
        const screen = render(<QrPaymentsScreen />);
        await waitFor(() => expect(screen.getByText('Revolut')).toBeTruthy());
        expect(screen.getByText(/Show these codes to clients/)).toBeTruthy();
        // read-only: no owner controls
        expect(screen.queryByText('Add')).toBeNull();
        expect(screen.queryByText('Edit')).toBeNull();
        expect(screen.queryByText('Hide')).toBeNull();
        expect(screen.queryByText('Show')).toBeNull();
        // and the service was called in instructor mode (isOwner=false)
        expect(listMock).toHaveBeenCalledWith(false);
    });

    it('owner sees management copy, all codes, and can open the Add form', async () => {
        asRole('owner');
        listMock.mockResolvedValue([
            mockQrPayCode({ id: 'c1', provider_name: 'Revolut' }),
            mockQrPayCode({ id: 'c2', provider_name: 'Bank Transfer', qr_image_url: null, qr_payload: 'iban:IE29' }),
        ]);
        const screen = render(<QrPaymentsScreen />);
        await waitFor(() => expect(screen.getByText('Bank Transfer')).toBeTruthy());
        expect(screen.getByText(/Manage payment codes/)).toBeTruthy();
        expect(listMock).toHaveBeenCalledWith(true);
        expect(screen.getByText('Add')).toBeTruthy();
        // per-code owner controls
        expect(screen.getAllByText('Edit').length).toBe(2);
        expect(screen.getAllByText('Hide').length).toBe(2);
    });

    it('inactive codes render with the Show (not Hide) control for owners', async () => {
        asRole('owner');
        listMock.mockResolvedValue([
            mockQrPayCode({ id: 'a', provider_name: 'Active Provider', is_active: true }),
            mockQrPayCode({ id: 'i', provider_name: 'Old Provider', is_active: false }),
        ]);
        const screen = render(<QrPaymentsScreen />);
        await waitFor(() => expect(screen.getByText('Old Provider')).toBeTruthy());
        expect(screen.getAllByText('Hide').length).toBe(1);
        expect(screen.getAllByText('Show').length).toBe(1);
    });
});

describe('QrPaymentsScreen — lifecycle & fallback states', () => {
    it('empty state copy differs by role (owner gets an action prompt)', async () => {
        asRole('owner');
        listMock.mockResolvedValue([]);
        const screen = render(<QrPaymentsScreen />);
        await waitFor(() => expect(screen.getByText('No payment codes available')).toBeTruthy());
        expect(screen.getByText('Add your first payment method to get started.')).toBeTruthy();
    });

    it('load failure surfaces an alert (not a crash, not silent)', async () => {
        asRole('owner');
        listMock.mockRejectedValue(new Error('row level security'));
        const screen = render(<QrPaymentsScreen />);
        await waitFor(() =>
            expect(showAlertMock).toHaveBeenCalledWith('Error', 'row level security', 'error')
        );
        expect(screen.getByText('No payment codes available')).toBeTruthy();
    });

    it('tapping a code opens the fullscreen presentation overlay', async () => {
        asRole('master', true);
        listMock.mockResolvedValue([mockQrPayCode({ provider_name: 'Bizum' })]);
        const screen = render(<QrPaymentsScreen />);
        await waitFor(() => expect(screen.getByText('Bizum')).toBeTruthy());
        fireEvent.press(screen.getByText('Bizum'));
        expect(screen.getByText('Ask the client to scan this code with their banking app')).toBeTruthy();
    });
});
