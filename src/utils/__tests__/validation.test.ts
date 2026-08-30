/**
 * Validation Utility Tests
 * Tests all phone, email, password, and name validation functions
 */
import {
    cleanPhoneNumber,
    validateIrishPhone,
    formatIrishPhone,
    normalizeIrishPhone,
    validateEmail,
    validatePassword,
    validateFullName,
    validateServiceName,
    parsePhoneNumber,
    validatePhone,
    formatPhone,
    normalizePhone,
    validatePrice,
    validatePostalCode,
    MAX_PHONE_LENGTH,
    VALID_PHONE_CHARS,
} from '../validation';

// ═══════════════════════════════════════════════════════════════════════════
// cleanPhoneNumber
// ═══════════════════════════════════════════════════════════════════════════
describe('cleanPhoneNumber', () => {
    it('removes spaces from phone number', () => {
        expect(cleanPhoneNumber('087 123 4567')).toBe('0871234567');
    });

    it('removes dashes from phone number', () => {
        expect(cleanPhoneNumber('087-123-4567')).toBe('0871234567');
    });

    it('removes parentheses from phone number', () => {
        expect(cleanPhoneNumber('(087) 1234567')).toBe('0871234567');
    });

    // Parity with meraki-WEB `src/lib/validation.ts`: cleanPhoneNumber now
    // returns digits only, so a country prefix survives without its '+'.
    it('strips the plus sign and keeps the digits', () => {
        expect(cleanPhoneNumber('+353871234567')).toBe('353871234567');
    });

    it('returns empty string for empty input', () => {
        expect(cleanPhoneNumber('')).toBe('');
    });

    it('returns digits-only string unchanged', () => {
        expect(cleanPhoneNumber('0871234567')).toBe('0871234567');
    });

    // Letters are not valid phone characters. The web build has always
    // rejected them outright rather than passing them to a country matcher.
    it('rejects a phone number containing letters', () => {
        expect(cleanPhoneNumber('087abc1234567')).toBe('');
    });

    it('rejects an over-long input instead of matching against it', () => {
        expect(cleanPhoneNumber('0'.repeat(51))).toBe('');
    });

    it('removes spaces, dashes, and parentheses mixed together', () => {
        expect(cleanPhoneNumber('(087) - 123 - 4567')).toBe('0871234567');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateIrishPhone
// ═══════════════════════════════════════════════════════════════════════════
describe('validateIrishPhone', () => {
    // Valid mobile numbers
    it('validates a standard 087 mobile number', () => {
        expect(validateIrishPhone('087 123 4567')).toEqual({ valid: true });
    });

    it('validates a +353 87 format mobile number', () => {
        expect(validateIrishPhone('+353 87 123 4567')).toEqual({ valid: true });
    });

    it('validates a 353 prefix mobile number', () => {
        expect(validateIrishPhone('353871234567')).toEqual({ valid: true });
    });

    it('validates a 00353 prefix mobile number', () => {
        expect(validateIrishPhone('00353871234567')).toEqual({ valid: true });
    });

    it('validates an 085 mobile number', () => {
        expect(validateIrishPhone('085 123 4567')).toEqual({ valid: true });
    });

    it('validates an 086 mobile number', () => {
        expect(validateIrishPhone('086 123 4567')).toEqual({ valid: true });
    });

    it('validates an 089 mobile number', () => {
        expect(validateIrishPhone('089 123 4567')).toEqual({ valid: true });
    });

    // Valid landline numbers
    it('validates a Dublin landline (01)', () => {
        const result = validateIrishPhone('01 234 5678');
        expect(result.valid).toBe(true);
    });

    // Invalid numbers
    it('rejects an empty string', () => {
        const result = validateIrishPhone('');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('rejects a whitespace-only string', () => {
        const result = validateIrishPhone('   ');
        expect(result.valid).toBe(false);
    });

    it('rejects an Irish mobile number that is too short', () => {
        const result = validateIrishPhone('087 1234');
        expect(result.valid).toBe(false);
    });

    it('rejects an Irish mobile number that is too long', () => {
        const result = validateIrishPhone('087 1234 56789');
        expect(result.valid).toBe(false);
    });

    it('accepts a number with 080 prefix (relaxed validation)', () => {
        const result = validateIrishPhone('080 123 4567');
        expect(result.valid).toBe(true);
    });

    it('rejects an Irish landline number that is too short', () => {
        const result = validateIrishPhone('01 2345');
        expect(result.valid).toBe(false);
    });

    it('rejects an Irish landline number that is too long', () => {
        const result = validateIrishPhone('01 2345 6789 012');
        expect(result.valid).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatIrishPhone
// ═══════════════════════════════════════════════════════════════════════════
describe('formatIrishPhone', () => {
    it('formats a raw mobile number to +353 87 123 4567', () => {
        expect(formatIrishPhone('0871234567')).toBe('+353 87 123 4567');
    });

    it('formats a number with +353 prefix', () => {
        expect(formatIrishPhone('+353871234567')).toBe('+353 87 123 4567');
    });

    it('formats a number with 353 prefix', () => {
        expect(formatIrishPhone('353871234567')).toBe('+353 87 123 4567');
    });

    it('formats a number with 00353 prefix', () => {
        expect(formatIrishPhone('00353871234567')).toBe('+353 87 123 4567');
    });

    it('formats a landline number', () => {
        expect(formatIrishPhone('012345678')).toBe('+353 12345678');
    });

    it('returns empty string for empty input', () => {
        expect(formatIrishPhone('')).toBe('');
    });

    it('returns original for too-short input', () => {
        const short = '08712';
        expect(formatIrishPhone(short)).toBe(short);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// normalizeIrishPhone
// ═══════════════════════════════════════════════════════════════════════════
describe('normalizeIrishPhone', () => {
    it('normalizes 087 format to E.164', () => {
        expect(normalizeIrishPhone('087 123 4567')).toBe('+353871234567');
    });

    it('normalizes +353 format to E.164', () => {
        expect(normalizeIrishPhone('+353 87 123 4567')).toBe('+353871234567');
    });

    it('normalizes 00353 format to E.164', () => {
        expect(normalizeIrishPhone('00353 87 123 4567')).toBe('+353871234567');
    });

    it('returns empty string for invalid number', () => {
        expect(normalizeIrishPhone('invalid')).toBe('');
    });

    it('returns empty string for empty input', () => {
        expect(normalizeIrishPhone('')).toBe('');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateEmail
// ═══════════════════════════════════════════════════════════════════════════
describe('validateEmail', () => {
    it('validates a standard email', () => {
        expect(validateEmail('user@example.com')).toEqual({ valid: true });
    });

    it('validates an email with subdomain', () => {
        expect(validateEmail('user@mail.example.com')).toEqual({ valid: true });
    });

    it('rejects email without @', () => {
        const result = validateEmail('userexample.com');
        expect(result.valid).toBe(false);
    });

    it('rejects email without domain', () => {
        const result = validateEmail('user@');
        expect(result.valid).toBe(false);
    });

    it('rejects empty string', () => {
        const result = validateEmail('');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('rejects email with spaces', () => {
        const result = validateEmail('user @example.com');
        expect(result.valid).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validatePassword
// ═══════════════════════════════════════════════════════════════════════════
describe('validatePassword', () => {
    it('validates a 6-character password', () => {
        expect(validatePassword('123456')).toEqual({ valid: true });
    });

    it('validates a long password', () => {
        expect(validatePassword('MyS3cur3P@ssw0rd!')).toEqual({ valid: true });
    });

    it('rejects a 5-character password', () => {
        const result = validatePassword('12345');
        expect(result.valid).toBe(false);
    });

    it('rejects an empty password', () => {
        const result = validatePassword('');
        expect(result.valid).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateServiceName
// ═══════════════════════════════════════════════════════════════════════════
describe('validateServiceName', () => {
    it('validates a standard service name', () => {
        expect(validateServiceName('Haircut')).toEqual({ valid: true });
    });

    it('validates a service name with leading and trailing spaces', () => {
        expect(validateServiceName('  Spa ')).toEqual({ valid: true });
    });

    it('rejects a service name with less than 3 characters', () => {
        const result = validateServiceName('Ha');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Service name must be at least 3 characters');
    });

    it('rejects a service name with less than 3 characters after trimming', () => {
        const result = validateServiceName('  H  ');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Service name must be at least 3 characters');
    });

    it('rejects an empty service name', () => {
        const result = validateServiceName('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Service name is required');
    });

    it('rejects whitespace-only service name', () => {
        const result = validateServiceName('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Service name is required');
    });

    it('rejects undefined/null inputs', () => {
        let result = validateServiceName(undefined as unknown as string);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Service name is required');

        result = validateServiceName(null as unknown as string);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Service name is required');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateFullName
// ═══════════════════════════════════════════════════════════════════════════
describe('validateFullName', () => {
    it('validates a standard name', () => {
        expect(validateFullName('John Doe')).toEqual({ valid: true });
    });

    it('validates a 2-character name', () => {
        expect(validateFullName('Jo')).toEqual({ valid: true });
    });

    it('rejects a 1-character name', () => {
        const result = validateFullName('J');
        expect(result.valid).toBe(false);
    });

    it('rejects an empty name', () => {
        const result = validateFullName('');
        expect(result.valid).toBe(false);
    });

    it('rejects whitespace-only name', () => {
        const result = validateFullName('   ');
        expect(result.valid).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validatePostalCode
// ═══════════════════════════════════════════════════════════════════════════
describe('validatePostalCode', () => {
    it('validates a standard 5-digit US zip code', () => {
        expect(validatePostalCode('12345')).toEqual({ valid: true });
    });

    it('validates a UK postcode with spaces', () => {
        expect(validatePostalCode('SW1A 1AA')).toEqual({ valid: true });
    });

    it('validates a US zip+4 code with a dash', () => {
        expect(validatePostalCode('12345-6789')).toEqual({ valid: true });
    });

    it('validates an alphanumeric postal code without spaces', () => {
        expect(validatePostalCode('A1B2C3')).toEqual({ valid: true });
    });

    it('validates the minimum length postal code (3 chars)', () => {
        expect(validatePostalCode('123')).toEqual({ valid: true });
    });

    it('validates the maximum length postal code (10 chars)', () => {
        expect(validatePostalCode('1234567890')).toEqual({ valid: true });
    });

    it('validates maximum length with dashes and spaces ignored', () => {
        expect(validatePostalCode('12-34 56-78 90')).toEqual({ valid: true });
    });

    it('rejects an empty postal code', () => {
        expect(validatePostalCode('')).toEqual({ valid: false, error: 'Postal code is required' });
    });

    it('rejects a postal code with only whitespaces', () => {
        expect(validatePostalCode('   ')).toEqual({ valid: false, error: 'Postal code is required' });
    });

    it('rejects a postal code that is too short (< 3 chars)', () => {
        expect(validatePostalCode('12')).toEqual({ valid: false, error: 'Please enter a valid postal code' });
    });

    it('rejects a postal code that is too long (> 10 chars)', () => {
        expect(validatePostalCode('12345678901')).toEqual({ valid: false, error: 'Please enter a valid postal code' });
    });

    it('rejects a postal code with invalid characters', () => {
        expect(validatePostalCode('123!@#')).toEqual({ valid: false, error: 'Please enter a valid postal code' });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// International Phone Helpers (parse, validate, format, normalize)
// ═══════════════════════════════════════════════════════════════════════════
describe('International Phone Validation & Formatting Helpers', () => {
    describe('parsePhoneNumber', () => {
        it('handles empty inputs, returning default IE', () => {
            expect(parsePhoneNumber('')).toEqual({ countryCode: 'IE', localNumber: '' });
            // Testing invalid inputs explicitly
            expect(parsePhoneNumber(null as unknown as string)).toEqual({ countryCode: 'IE', localNumber: '' });
            expect(parsePhoneNumber(undefined as unknown as string)).toEqual({ countryCode: 'IE', localNumber: '' });
        });

        it('strips spaces from inputs before parsing', () => {
            expect(parsePhoneNumber('+353 87 123 4567')).toEqual({ countryCode: 'IE', localNumber: '871234567' });
            expect(parsePhoneNumber(' +44 7700 900 000 ')).toEqual({ countryCode: 'GB', localNumber: '7700900000' });
        });

        it('falls back to IE for unknown prefixes', () => {
            // unknown international prefix (+99)
            expect(parsePhoneNumber('+99123456')).toEqual({ countryCode: 'IE', localNumber: '+99123456' });
            // ordinary number starting with 0 but not matching any known country pattern falls back to IE, stripping the 0
            expect(parsePhoneNumber('0987654321')).toEqual({ countryCode: 'IE', localNumber: '987654321' });
            // ordinary number not starting with 0 or any country code falls back to IE
            expect(parsePhoneNumber('987654321')).toEqual({ countryCode: 'IE', localNumber: '987654321' });
        });

        it('parses Irish numbers correctly', () => {
            expect(parsePhoneNumber('+353871234567')).toEqual({ countryCode: 'IE', localNumber: '871234567' });
            expect(parsePhoneNumber('00353871234567')).toEqual({ countryCode: 'IE', localNumber: '871234567' });
            expect(parsePhoneNumber('353871234567')).toEqual({ countryCode: 'IE', localNumber: '871234567' });
            expect(parsePhoneNumber('0871234567')).toEqual({ countryCode: 'IE', localNumber: '871234567' });
        });

        it('parses UK numbers correctly', () => {
            expect(parsePhoneNumber('+447700900000')).toEqual({ countryCode: 'GB', localNumber: '7700900000' });
            expect(parsePhoneNumber('00447700900000')).toEqual({ countryCode: 'GB', localNumber: '7700900000' });
            expect(parsePhoneNumber('447700900000')).toEqual({ countryCode: 'GB', localNumber: '7700900000' });
        });

        it('parses US numbers correctly', () => {
            expect(parsePhoneNumber('+12015550123')).toEqual({ countryCode: 'US', localNumber: '2015550123' });
            expect(parsePhoneNumber('0012015550123')).toEqual({ countryCode: 'US', localNumber: '2015550123' });
            expect(parsePhoneNumber('12015550123')).toEqual({ countryCode: 'US', localNumber: '2015550123' });
        });

        it('parses German numbers correctly', () => {
            expect(parsePhoneNumber('+491701234567')).toEqual({ countryCode: 'DE', localNumber: '1701234567' });
            expect(parsePhoneNumber('00491701234567')).toEqual({ countryCode: 'DE', localNumber: '1701234567' });
            expect(parsePhoneNumber('491701234567')).toEqual({ countryCode: 'DE', localNumber: '1701234567' });
        });

        it('parses French numbers correctly', () => {
            expect(parsePhoneNumber('+33612345678')).toEqual({ countryCode: 'FR', localNumber: '612345678' });
            expect(parsePhoneNumber('0033612345678')).toEqual({ countryCode: 'FR', localNumber: '612345678' });
            expect(parsePhoneNumber('33612345678')).toEqual({ countryCode: 'FR', localNumber: '612345678' });
        });

        it('parses Spanish numbers correctly', () => {
            expect(parsePhoneNumber('+34612345678')).toEqual({ countryCode: 'ES', localNumber: '612345678' });
            expect(parsePhoneNumber('0034612345678')).toEqual({ countryCode: 'ES', localNumber: '612345678' });
            expect(parsePhoneNumber('34612345678')).toEqual({ countryCode: 'ES', localNumber: '612345678' });
        });
    });

    describe('validatePhone', () => {
        it('validates UK numbers correctly', () => {
            expect(validatePhone('7700900000', 'GB')).toEqual({ valid: true });
            expect(validatePhone('07700900000', 'GB')).toEqual({ valid: true });
            expect(validatePhone('77009000', 'GB')).toEqual({ valid: false, error: 'UK phone numbers must be 9-11 digits' });
        });

        it('validates US numbers correctly', () => {
            expect(validatePhone('2015550123', 'US')).toEqual({ valid: true });
            expect(validatePhone('12015550123', 'US')).toEqual({ valid: true });
            expect(validatePhone('12345', 'US')).toEqual({ valid: false, error: 'US/Canada phone numbers must be 10 digits' });
        });

        it('validates numbers with international prefix', () => {
            expect(validatePhone('+353899589076', 'IE')).toEqual({ valid: true });
            expect(validatePhone('+447700900000', 'GB')).toEqual({ valid: true });
        });
    });

    describe('formatPhone', () => {
        it('formats UK numbers', () => {
            expect(formatPhone('7700900000', 'GB')).toBe('7700 900000');
        });

        it('formats US numbers', () => {
            expect(formatPhone('2015550123', 'US')).toBe('(201) 555-0123');
        });
    });

    describe('normalizePhone', () => {
        it('normalizes UK numbers to E.164', () => {
            expect(normalizePhone('7700900000', 'GB')).toBe('+447700900000');
            expect(normalizePhone('07700900000', 'GB')).toBe('+447700900000');
        });

        it('normalizes US numbers to E.164', () => {
            expect(normalizePhone('2015550123', 'US')).toBe('+12015550123');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // validatePrice
    // ═══════════════════════════════════════════════════════════════════════════
    describe('validatePrice', () => {
        it('validates a valid numeric price', () => {
            expect(validatePrice(10)).toEqual({ valid: true });
            expect(validatePrice(0)).toEqual({ valid: true });
            expect(validatePrice(99.99)).toEqual({ valid: true });
        });

        it('validates a valid string price', () => {
            expect(validatePrice('10')).toEqual({ valid: true });
            expect(validatePrice('0')).toEqual({ valid: true });
            expect(validatePrice('99.99')).toEqual({ valid: true });
        });

        it('rejects missing or empty price', () => {
            expect(validatePrice('')).toEqual({ valid: false, error: 'Price is required' });
            expect(validatePrice(undefined as any)).toEqual({ valid: false, error: 'Price is required' });
            expect(validatePrice(null as any)).toEqual({ valid: false, error: 'Price is required' });
        });

        it('returns error for invalid string or NaN values', () => {
            expect(validatePrice('abc')).toEqual({ valid: false, error: 'Price must be a valid number' });
            expect(validatePrice(NaN)).toEqual({ valid: false, error: 'Price must be a valid number' });
            expect(validatePrice('12.34abc')).toEqual({ valid: false, error: 'Price must be a valid number' });
        });

        it('returns error for negative values', () => {
            expect(validatePrice(-1)).toEqual({ valid: false, error: 'Price cannot be negative' });
            expect(validatePrice('-10.50')).toEqual({ valid: false, error: 'Price cannot be negative' });
            expect(validatePrice(-0.01)).toEqual({ valid: false, error: 'Price cannot be negative' });
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Web parity — hardened phone input handling
//
// meraki-WEB's src/lib/validation.ts caps every phone helper at 50 characters
// and rejects anything outside `[+\d\s().-]` before it reaches a country
// matcher. The mobile copy had neither guard, and disagreed with the web on
// the minimum Irish length (8 vs 7 digits), so a 7-digit Irish landline was
// accepted on the website and rejected in the app.
// ═══════════════════════════════════════════════════════════════════════════
describe('phone input hardening (parity with meraki-WEB)', () => {
    const longInput = '3'.repeat(MAX_PHONE_LENGTH + 1);

    it('exposes the shared character allow-list', () => {
        expect(VALID_PHONE_CHARS.test('+353 (87) 123-4567')).toBe(true);
        expect(VALID_PHONE_CHARS.test('087abc')).toBe(false);
        expect(VALID_PHONE_CHARS.test('087;DROP')).toBe(false);
    });

    it('accepts a 7-digit Irish number, matching the website', () => {
        expect(validateIrishPhone('+353 1234567')).toEqual({ valid: true });
        expect(validatePhone('1234567', 'IE')).toEqual({ valid: true });
    });

    it('still rejects a 6-digit Irish number', () => {
        expect(validateIrishPhone('+353 123456').valid).toBe(false);
    });

    it('rejects over-long input in every phone helper', () => {
        expect(validatePhone(longInput, 'IE').valid).toBe(false);
        expect(validateIrishPhone(longInput).valid).toBe(false);
        expect(formatPhone(longInput, 'IE')).toBe('');
        expect(formatIrishPhone(longInput)).toBe('');
        expect(normalizePhone(longInput, 'IE')).toBe('');
        expect(normalizeIrishPhone(longInput)).toBe('');
        expect(cleanPhoneNumber(longInput)).toBe('');
        expect(parsePhoneNumber(longInput)).toEqual({ countryCode: 'IE', localNumber: '' });
    });

    it('rejects input containing characters that are not phone characters', () => {
        const bad = '087<script>';
        expect(validatePhone(bad, 'IE').valid).toBe(false);
        expect(validateIrishPhone(bad).valid).toBe(false);
        expect(formatPhone(bad, 'IE')).toBe('');
        expect(normalizePhone(bad, 'IE')).toBe('');
        expect(parsePhoneNumber(bad)).toEqual({ countryCode: 'IE', localNumber: '' });
    });

    it('leaves ordinary numbers working', () => {
        expect(validateIrishPhone('087 123 4567')).toEqual({ valid: true });
        expect(normalizeIrishPhone('087 123 4567')).toBe('+353871234567');
        expect(parsePhoneNumber('+353871234567')).toEqual({
            countryCode: 'IE',
            localNumber: '871234567',
        });
    });
});
