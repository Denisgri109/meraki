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
        const result = validateIrishPhone('087 12345');
        expect(result.valid).toBe(false);
    });

    it('rejects an Irish mobile number that is too long', () => {
        const result = validateIrishPhone('087 1234 56789');
        expect(result.valid).toBe(false);
    });

    it('rejects a number with invalid prefix', () => {
        const result = validateIrishPhone('080 123 4567');
        expect(result.valid).toBe(false);
    });

    it('rejects an Irish landline number that is too short', () => {
        const result = validateIrishPhone('01 2345');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid landline number length');
    });

    it('rejects an Irish landline number that is too long', () => {
        const result = validateIrishPhone('01 2345 6789 012');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid landline number length');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatIrishPhone
// ═══════════════════════════════════════════════════════════════════════════
describe('formatIrishPhone', () => {
    it('formats a raw mobile number to +353 XX XXX XXXX', () => {
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
