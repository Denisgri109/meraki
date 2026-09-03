import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Keychain/Keystore-backed storage for the Supabase auth session.
 *
 * The session was previously persisted straight to AsyncStorage, which is plain unencrypted
 * files on both platforms — anyone with the device's app sandbox could read the refresh
 * token. The app's own audit records this as SEC-AUTH-STORAGE (HIGH).
 *
 * Two details make this more than a one-line swap:
 *
 *  1. SecureStore rejects values much over 2KB on Android, and a Supabase session carrying a
 *     sizeable JWT goes past that. Values are split across numbered chunk entries with a
 *     manifest at the base key.
 *  2. Anyone already signed in has their session in AsyncStorage. getItem migrates it across
 *     on first read, so upgrading does not sign everybody out.
 *
 * Every operation falls back to AsyncStorage if the secure store is unavailable — some
 * devices and most simulators can refuse it — because a storage error here would lock the
 * user out entirely.
 */

/** Comfortably under SecureStore's Android limit, leaving room for the key and overhead. */
const CHUNK_SIZE = 1800;

/** Marks a base key whose real value is spread over numbered chunks. */
const CHUNK_MANIFEST = '__meraki_chunks__:';

/** SecureStore only accepts alphanumerics, ".", "-" and "_" in a key. */
function safeKey(key: string): string {
    return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

const chunkKey = (key: string, index: number) => `${safeKey(key)}.${index}`;

async function clearChunks(key: string, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
        try {
            await SecureStore.deleteItemAsync(chunkKey(key, i));
        } catch {
            /* already gone */
        }
    }
}

/** How many chunks a manifest advertises, or 0 when the value is not chunked. */
function manifestCount(value: string | null): number {
    if (!value || !value.startsWith(CHUNK_MANIFEST)) return 0;
    const count = Number.parseInt(value.slice(CHUNK_MANIFEST.length), 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
}

export async function getItem(key: string): Promise<string | null> {
    try {
        const head = await SecureStore.getItemAsync(safeKey(key));

        if (head !== null) {
            const count = manifestCount(head);
            if (count === 0) return head;

            const parts: string[] = [];
            for (let i = 0; i < count; i++) {
                const part = await SecureStore.getItemAsync(chunkKey(key, i));
                // A missing chunk means a half-written value; treat the whole thing as absent
                // rather than handing back a corrupt session.
                if (part === null) return null;
                parts.push(part);
            }
            return parts.join('');
        }

        // Nothing in the secure store yet. Anyone signed in before this change still has
        // their session in AsyncStorage — move it across rather than signing them out.
        const legacy = await AsyncStorage.getItem(key);
        if (legacy !== null) {
            await setItem(key, legacy);
            await AsyncStorage.removeItem(key);
            return legacy;
        }

        return null;
    } catch {
        return AsyncStorage.getItem(key);
    }
}

export async function setItem(key: string, value: string): Promise<void> {
    try {
        // Clear whatever was there so a shorter value cannot leave stale chunks behind.
        const previous = await SecureStore.getItemAsync(safeKey(key));
        await clearChunks(key, manifestCount(previous));

        if (value.length <= CHUNK_SIZE) {
            await SecureStore.setItemAsync(safeKey(key), value);
            return;
        }

        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
            chunks.push(value.slice(i, i + CHUNK_SIZE));
        }

        // Chunks first, manifest last: a crash midway leaves the base key pointing at the
        // old value or nothing, never at an incomplete set.
        for (let i = 0; i < chunks.length; i++) {
            await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
        }
        await SecureStore.setItemAsync(safeKey(key), `${CHUNK_MANIFEST}${chunks.length}`);
    } catch {
        await AsyncStorage.setItem(key, value);
    }
}

export async function removeItem(key: string): Promise<void> {
    try {
        const head = await SecureStore.getItemAsync(safeKey(key));
        await clearChunks(key, manifestCount(head));
        await SecureStore.deleteItemAsync(safeKey(key));
    } catch {
        /* fall through — the AsyncStorage copy still has to go */
    }
    try {
        await AsyncStorage.removeItem(key);
    } catch {
        /* nothing more to do */
    }
}

/** The storage shape supabase-js expects for `auth.storage`. */
export const secureStorageAdapter = { getItem, setItem, removeItem };

export default secureStorageAdapter;
