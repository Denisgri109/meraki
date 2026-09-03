import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getItem, setItem, removeItem } from '../secureStorage';

jest.mock('expo-secure-store');
jest.mock('@react-native-async-storage/async-storage');

const secure = SecureStore as jest.Mocked<typeof SecureStore>;
const async = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

/** An in-memory stand-in for the Keychain, so chunking can be observed directly. */
function fakeSecureStore() {
    const store = new Map<string, string>();
    secure.getItemAsync.mockImplementation(async (k: string) => store.get(k) ?? null);
    secure.setItemAsync.mockImplementation(async (k: string, v: string) => { store.set(k, v); });
    secure.deleteItemAsync.mockImplementation(async (k: string) => { store.delete(k); });
    return store;
}

const KEY = 'sb-project-auth-token';

beforeEach(() => {
    jest.clearAllMocks();
    async.getItem.mockResolvedValue(null);
    async.setItem.mockResolvedValue(undefined);
    async.removeItem.mockResolvedValue(undefined);
});

describe('secureStorage — small values', () => {
    it('round-trips a value through the secure store', async () => {
        fakeSecureStore();
        await setItem(KEY, 'a-short-session');
        await expect(getItem(KEY)).resolves.toBe('a-short-session');
    });

    it('never writes the session to AsyncStorage when the secure store works', async () => {
        fakeSecureStore();
        await setItem(KEY, 'a-short-session');
        expect(async.setItem).not.toHaveBeenCalled();
    });

    it('returns null for a key that was never written', async () => {
        fakeSecureStore();
        await expect(getItem(KEY)).resolves.toBeNull();
    });
});

describe('secureStorage — values past the SecureStore size limit', () => {
    // A real Supabase session with a sizeable JWT lands well over 2KB, which Android rejects.
    const big = 'x'.repeat(5000);

    it('round-trips a value larger than a single entry allows', async () => {
        fakeSecureStore();
        await setItem(KEY, big);
        await expect(getItem(KEY)).resolves.toBe(big);
    });

    it('splits it into chunks with a manifest at the base key', async () => {
        const store = fakeSecureStore();
        await setItem(KEY, big);

        expect(store.get(KEY)).toMatch(/^__meraki_chunks__:3$/);
        expect(store.get(`${KEY}.0`)).toHaveLength(1800);
        expect(store.get(`${KEY}.2`)).toHaveLength(1400);
    });

    it('does not leave stale chunks when a long value is replaced by a short one', async () => {
        const store = fakeSecureStore();
        await setItem(KEY, big);
        await setItem(KEY, 'small');

        expect(store.get(KEY)).toBe('small');
        expect(store.has(`${KEY}.0`)).toBe(false);
        expect(store.has(`${KEY}.2`)).toBe(false);
        await expect(getItem(KEY)).resolves.toBe('small');
    });

    it('reports a half-written value as absent rather than returning it corrupt', async () => {
        const store = fakeSecureStore();
        await setItem(KEY, big);
        store.delete(`${KEY}.1`);

        await expect(getItem(KEY)).resolves.toBeNull();
    });

    it('removes every chunk on removeItem', async () => {
        const store = fakeSecureStore();
        await setItem(KEY, big);
        await removeItem(KEY);

        expect([...store.keys()]).toEqual([]);
        await expect(getItem(KEY)).resolves.toBeNull();
    });
});

describe('secureStorage — migrating an existing session', () => {
    it('moves a session already in AsyncStorage into the secure store on first read', async () => {
        const store = fakeSecureStore();
        async.getItem.mockResolvedValue('session-from-before-the-upgrade');

        await expect(getItem(KEY)).resolves.toBe('session-from-before-the-upgrade');

        expect(store.get(KEY)).toBe('session-from-before-the-upgrade');
        expect(async.removeItem).toHaveBeenCalledWith(KEY);
    });

    it('reads from the secure store on the next call, not AsyncStorage', async () => {
        fakeSecureStore();
        async.getItem.mockResolvedValue('session-from-before-the-upgrade');
        await getItem(KEY);

        async.getItem.mockClear();
        await expect(getItem(KEY)).resolves.toBe('session-from-before-the-upgrade');
        expect(async.getItem).not.toHaveBeenCalled();
    });
});

describe('secureStorage — when the secure store is unavailable', () => {
    // Some devices and most simulators refuse SecureStore. Falling back keeps the user
    // signed in instead of locking them out of the app entirely.
    it('falls back to AsyncStorage on write', async () => {
        secure.setItemAsync.mockRejectedValue(new Error('Keychain unavailable'));
        secure.getItemAsync.mockResolvedValue(null);

        await setItem(KEY, 'value');
        expect(async.setItem).toHaveBeenCalledWith(KEY, 'value');
    });

    it('falls back to AsyncStorage on read', async () => {
        secure.getItemAsync.mockRejectedValue(new Error('Keychain unavailable'));
        async.getItem.mockResolvedValue('fallback-session');

        await expect(getItem(KEY)).resolves.toBe('fallback-session');
    });

    it('still clears AsyncStorage on removeItem', async () => {
        secure.getItemAsync.mockRejectedValue(new Error('Keychain unavailable'));

        await removeItem(KEY);
        expect(async.removeItem).toHaveBeenCalledWith(KEY);
    });
});
