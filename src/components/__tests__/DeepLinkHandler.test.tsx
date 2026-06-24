import React from 'react';
import { Linking } from 'react-native';
import { render } from '@testing-library/react-native';
import { DeepLinkHandler } from '../DeepLinkHandler';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../contexts/ModalContext', () => ({
  useModal: jest.fn(),
}));

jest.mock('react-native-nfc-manager', () => ({
  default: {
    start: jest.fn(),
    isSupported: jest.fn(),
    requestTechnology: jest.fn(),
    cancelTechnologyRequest: jest.fn(),
    writeNdefMessage: jest.fn(),
    setAlertMessageIOS: jest.fn(),
  },
  NfcTech: {
    Ndef: 'Ndef',
  },
  Ndef: {
    encodeMessage: jest.fn(),
    uriRecord: jest.fn(),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

jest.mock('react-native/Libraries/Modal/Modal', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

jest.mock('../loyalty', () => ({
  StampSuccessModal: () => null,
  NfcPairingModal: () => null,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: jest.fn(),
      verifyOtp: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

describe('DeepLinkHandler Security Validations', () => {
  let addEventListenerMock: jest.Mock;
  let showModalMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    showModalMock = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({ user: null, profile: null });
    (useModal as jest.Mock).mockReturnValue({ showModal: showModalMock, hideModal: jest.fn() });
    (useNavigation as jest.Mock).mockReturnValue({ navigate: jest.fn() });

    addEventListenerMock = jest.fn().mockReturnValue({ remove: jest.fn() });
    Linking.addEventListener = addEventListenerMock;
    Linking.getInitialURL = jest.fn().mockResolvedValue(null);

    // Silence expected console outputs
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
  });

  const simulateDeepLink = async (url: string) => {
    render(<DeepLinkHandler><></></DeepLinkHandler>);
    // The second call is the event listener handleDeepLink (since useEffect runs once)
    const handler = addEventListenerMock.mock.calls[0][1];
    await handler({ url });
  };

  it('rejects malicious deep link pretending to be auth-callback', async () => {
    await simulateDeepLink('https://evil.com/?auth-callback=true&code=123');
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('Ignoring deep link from unknown origin:', 'https://evil.com/?auth-callback=true&code=123');
  });

  it('rejects another scheme pretending to be meraki', async () => {
    await simulateDeepLink('malicious://auth-callback?code=123');
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('Ignoring deep link from unknown origin:', 'malicious://auth-callback?code=123');
  });

  it('accepts legitimate meraki scheme auth-callback', async () => {
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValueOnce({ error: null });
    await simulateDeepLink('meraki://auth-callback?code=123');
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('123');
  });

  it('accepts legitimate meraki https auth-callback', async () => {
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValueOnce({ error: null });
    await simulateDeepLink('https://meraki.app/auth-callback?code=123');
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('123');
  });
});
