/**
 * Tier 5 — Mobile security & accessibility static audit.
 *
 * Deterministic source-level assertions. These guard security invariants and
 * encode the CURRENT accessibility floor so fixes can only move the floor up.
 *
 * Findings are ALSO reported to the suite output via `security-report.json`
 * written to ../.. on each run (consumed by run_all_tests.bat).
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SRC, '..');

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir)) {
        const fp = path.join(dir, entry);
        const st = fs.statSync(fp);
        if (st.isDirectory()) {
            if (entry === '__tests__' || entry === '__mocks__') continue;
            walk(fp, out);
        } else if (/\.(tsx?|jsx?)$/.test(entry)) {
            out.push(fp);
        }
    }
    return out;
}

const SOURCE_FILES = walk(SRC);
const read = (fp: string) => fs.readFileSync(fp, 'utf8');

// ---------------------------------------------------------------------------
// 1. Credential / token storage contract
// ---------------------------------------------------------------------------

describe('Security — sensitive data must never reach AsyncStorage outside the auth adapter', () => {
    // AsyncStorage usage itself is an audited finding; we lock the contract
    // to "auth adapter + non-sensitive UX state only".
    const SENSITIVE_KEY_PATTERNS = [
        /password/i,
        /api[_-]?key/i,
        /secret/i,
        /token(?!_prompt)/i,        // refresh/access tokens, bearer tokens
        /refresh/i,
        /bearer/i,
        /pin[_-]?code/i,
        /card[_-]?(number|cvc|cvv)/i,
        /stripe[_-]?(sk|secret)/i,
    ];

    it('no AsyncStorage.setItem writes a dirty/sensitive key anywhere in src/', () => {
        const offenders: string[] = [];
        for (const fp of SOURCE_FILES) {
            const content = read(fp);
            const setCalls = content.matchAll(/AsyncStorage\.setItem\(\s*['"`]([^'"`]+)['"`]/g);
            for (const m of setCalls) {
                const key = m[1];
                if (SENSITIVE_KEY_PATTERNS.some((re) => re.test(key))) {
                    offenders.push(`${path.relative(SRC, fp)} -> "${key}"`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('the Supabase auth session is the ONLY AsyncStorage tenant of lib/supabase.ts', () => {
        const supa = read(path.join(SRC, 'lib', 'supabase.ts'));
        // The auth adapter may use AsyncStorage (documented finding), but the file
        // must not also persist anything else itself.
        const sets = supa.match(/AsyncStorage\.setItem\(/g) ?? [];
        expect(sets.length).toBe(0);
    });

    it('only approved non-sensitive AsyncStorage keys exist across the app', () => {
        const approved = new Set([
            '@meraki_cart',                        // cart line items
            '@meraki_notification_prompt_shown',   // UX flag
            '@meraki_site_content',                // public owner-authored copy (world-readable)
            'last_consultations_view',             // owner UX timestamp
            'client_activity_cleared_at',          // client UX timestamp
            'supabase.auth.token',                 // supabase-js v1 legacy cleanup target
        ]);
        const found = new Set<string>();
        for (const fp of SOURCE_FILES) {
            const content = read(fp);
            for (const m of content.matchAll(/AsyncStorage\.(?:setItem|getItem|removeItem)\(\s*['"`]([^'"`]+)['"`]/g)) {
                found.add(m[1]);
            }
        }
        // cachedDurationStr uses a dynamic template key in CourseDetailScreen — asserted separately.
        const unknown = [...found].filter((k) => !approved.has(k));
        expect(unknown).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 2. Auth lockout / session handling contract (source-level)
// ---------------------------------------------------------------------------

describe('Security — auth session & logout hygiene', () => {
    it('AuthContext.clearAuthData removes the legacy supabase token key on logout', () => {
        const auth = read(path.join(SRC, 'contexts', 'AuthContext.tsx'));
        expect(auth).toMatch(/AsyncStorage\.removeItem\(\s*['"`]supabase\.auth\.token['"`]\s*\)/);
    });

    it('the supabase client is configured with persistSession:true and autoRefreshToken:true', () => {
        const supa = read(path.join(SRC, 'lib', 'supabase.ts'));
        expect(supa).toMatch(/persistSession:\s*true/);
        expect(supa).toMatch(/autoRefreshToken:\s*true/);
        expect(supa).toMatch(/detectSessionInUrl:\s*false/);
    });

    it('app.json does not ship an embedded service-role key', () => {
        const appJson = read(path.join(APP_ROOT, 'app.json'));
        expect(appJson).not.toMatch(/service_role/i);
        expect(appJson).not.toMatch(/sk_live/);
    });
});

// ---------------------------------------------------------------------------
// 3. Accessibility floor — pins the existing labels as a regression guard
// ---------------------------------------------------------------------------

describe('Accessibility — existing labels are preserved (regression floor)', () => {
    const FILES_WITH_A11Y_PROPS = [
        'components/academy/LessonQAChat.tsx',
        'components/PilatesWaiverSheet.tsx',
        'components/ui/SafeBackButton.tsx',
        'screens/client/BookAndChatScreen.tsx',
        'screens/owner/academy/ManageAcademyScreen.tsx',
        'screens/owner/PilatesTimetableScreen.tsx',
    ];

    it.each(FILES_WITH_A11Y_PROPS)('%s keeps at least one accessibility prop', (rel) => {
        const fp = path.join(SRC, rel);
        expect(fs.existsSync(fp)).toBe(true);
        const content = read(fp);
        expect(/accessibility(Label|Hint|Role|State)/.test(content)).toBe(true);
    });

    it('SafeBackButton (global back control) exposes an accessibilityLabel AND role=button', () => {
        const content = read(path.join(SRC, 'components', 'ui', 'SafeBackButton.tsx'));
        expect(content).toMatch(/accessibilityLabel\s*=/);
        expect(content).toMatch(/accessibilityRole\s*=\s*["'`]button["'`]/);
    });
});

// ---------------------------------------------------------------------------
// 4. Write the audit report for the batch script
// ---------------------------------------------------------------------------

afterAll(() => {
    const a11y = SOURCE_FILES.filter((f) => /accessibility(Label|Hint|Role|State)/.test(read(f)));
    const report = {
        generatedAt: new Date().toISOString(),
        totals: {
            sourceFilesScanned: SOURCE_FILES.length,
            filesWithAccessibilityProps: a11y.length,
            accessibilityCoveragePct: Number(((a11y.length / SOURCE_FILES.length) * 100).toFixed(1)),
        },
        findings: [
            {
                id: 'SEC-AUTH-STORAGE',
                severity: 'HIGH',
                title: 'Supabase session persisted in AsyncStorage instead of SecureStore/Keychain',
                location: 'src/lib/supabase.ts:11',
                recommendation:
                    'Swap the auth.storage adapter to an ExpoSecureStore-backed shim (SecureStore has a 2KB value limit — chunk the JWT) so refresh tokens live in Keychain/Keystore.',
            },
            {
                id: 'SEC-BIOMETRIC',
                severity: 'MEDIUM',
                title: 'No biometric app-unlock (expo-local-authentication absent from package.json)',
                recommendation:
                    'Add optional FaceID/TouchID gate on app foreground when a session exists.',
            },
            {
                id: 'A11Y-COVERAGE',
                severity: 'MEDIUM',
                title: `${a11y.length}/${SOURCE_FILES.length} source files declare accessibility props`,
                recommendation:
                    'Every icon-only TouchableOpacity and primary CTA needs accessibilityLabel/accessibilityRole; minimum touch target 44x44.',
            },
        ],
    };
    const out = path.join(APP_ROOT, 'test-results', 'security-report.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
});
