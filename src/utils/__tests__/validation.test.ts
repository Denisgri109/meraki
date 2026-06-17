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
    parsePhoneNumber,
    validatePhone,
    formatPhone,
    normalizePhone,
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

    it('removes plus sign from phone number', () => {
        expect(cleanPhoneNumber('+353871234567')).toBe('353871234567');
    });

    it('returns empty string for empty input', () => {
        expect(cleanPhoneNumber('')).toBe('');
    });

    it('returns digits-only string unchanged', () => {
        expect(cleanPhoneNumber('0871234567')).toBe('0871234567');
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
// International Phone Helpers (parse, validate, format, normalize)
// ═══════════════════════════════════════════════════════════════════════════
describe('International Phone Validation & Formatting Helpers', () => {
    describe('parsePhoneNumber', () => {
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
        it('returns empty string for empty input', () => {
            expect(formatPhone('', 'US')).toBe('');
            expect(formatPhone('   ', 'IE')).toBe('');
            expect(formatPhone(null as any, 'FR')).toBe('');
        });

        it('returns original input for unsupported country code', () => {
            expect(formatPhone('1234567890', 'XX')).toBe('1234567890');
        });

        it('formats Irish numbers correctly (IE)', () => {
            // Mobile formatting (9 digits after removing 0)
            expect(formatPhone('0871234567', 'IE')).toBe('87 123 4567');
            // Not mobile or not 9 digits - returns cleaned local string
            expect(formatPhone('01234567', 'IE')).toBe('1234567');
            // Too short - returns raw
            expect(formatPhone('12345', 'IE')).toBe('12345');
        });

        it('formats UK numbers correctly (GB)', () => {
            // Exactly 10 digits
            expect(formatPhone('7700900000', 'GB')).toBe('7700 900000');
            expect(formatPhone('07700900000', 'GB')).toBe('7700 900000'); // the '0' prefix is stripped, making it 10 digits
            // Not 10 digits
            expect(formatPhone('12345678', 'GB')).toBe('12345678');
        });

        it('formats US/Canada numbers correctly (US)', () => {
            // Exactly 10 digits
            expect(formatPhone('2015550123', 'US')).toBe('(201) 555-0123');
            // 11 digits starting with 1
            expect(formatPhone('12015550123', 'US')).toBe('(201) 555-0123');
            // Not 10 digits
            expect(formatPhone('123456789', 'US')).toBe('123456789');
        });

        it('formats German numbers correctly (DE)', () => {
            // 3 or more digits
            expect(formatPhone('1701234567', 'DE')).toBe('170 1234567');
            expect(formatPhone('01701234567', 'DE')).toBe('170 1234567'); // 0 stripped
            // Less than 3 digits
            expect(formatPhone('12', 'DE')).toBe('12');
        });

        it('formats French numbers correctly (FR)', () => {
            // Exactly 9 digits
            expect(formatPhone('612345678', 'FR')).toBe('6 12 34 56 78');
            expect(formatPhone('0612345678', 'FR')).toBe('6 12 34 56 78'); // 0 stripped, becomes 9
            // Not 9 digits
            expect(formatPhone('12345678', 'FR')).toBe('12345678');
        });

        it('formats Spanish numbers correctly (ES)', () => {
            // Exactly 9 digits
            expect(formatPhone('612345678', 'ES')).toBe('612 345 678');
            // Not 9 digits
            expect(formatPhone('12345678', 'ES')).toBe('12345678');
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
});
