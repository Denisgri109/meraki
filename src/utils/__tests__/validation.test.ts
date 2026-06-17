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
        const result = validateIrishPhone('087 12');
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

    it('returns empty string for a non-IE international number', () => {
        expect(normalizeIrishPhone('+44 7700 900000')).toBe('');
    });

    it('normalizes local landline numbers correctly', () => {
        expect(normalizeIrishPhone('01 234 5678')).toBe('+35312345678');
    });

    it('normalizes numbers with formatting characters correctly', () => {
        expect(normalizeIrishPhone('(087)-123-4567')).toBe('+353871234567');
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
});
