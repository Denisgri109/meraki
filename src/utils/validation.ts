/**
 * Phone number validation utility for Irish phone numbers (+353)
 */

// Irish mobile prefixes (after removing the leading 0)
const IRISH_MOBILE_PREFIXES = ['83', '85', '86', '87', '88', '89'];

// Irish landline area codes (after removing the leading 0)
const IRISH_LANDLINE_PREFIXES = ['1', '21', '22', '23', '24', '25', '26', '27', '28', '29', '402', '404', '41', '42', '43', '44', '45', '46', '47', '49', '51', '52', '53', '56', '57', '58', '59', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '74', '76', '90', '91', '93', '94', '95', '96', '97', '98', '99'];

/**
 * Removes all non-digit characters from a phone number
 */
export function cleanPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
}

/**
 * Validates an Irish phone number
 * Accepts formats like:
 * - 087 123 4567
 * - +353 87 123 4567
 * - 35387 123 4567
 * - 0871234567
 * 
 * @returns true if valid Irish phone number, false otherwise
 */
export function validateIrishPhone(phone: string): { valid: boolean; error?: string } {
    if (!phone || phone.trim() === '') {
        return { valid: false, error: 'Phone number is required' };
    }

    let cleaned = cleanPhoneNumber(phone);

    // Remove leading + if present (already cleaned but just in case)
    if (phone.startsWith('+')) {
        cleaned = cleanPhoneNumber(phone.substring(1));
    }

    // Check if it starts with 353 (Ireland country code)
    if (cleaned.startsWith('353')) {
        cleaned = cleaned.substring(3);
    }
    // Check if it starts with 00353 (international format)
    else if (cleaned.startsWith('00353')) {
        cleaned = cleaned.substring(5);
    }
    // Check if it starts with 0 (local format)
    else if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // Now cleaned should be: XX XXXX XXX or similar (without country code or leading 0)

    // Check for valid mobile prefix
    const isMobile = IRISH_MOBILE_PREFIXES.some(prefix => cleaned.startsWith(prefix));

    if (isMobile) {
        // Irish mobile numbers are 9 digits after the 0 (e.g., 87 123 4567)
        if (cleaned.length !== 9) {
            return { valid: false, error: 'Irish mobile numbers must have 9 digits after the prefix' };
        }
        return { valid: true };
    }

    // Check for valid landline prefix
    const isLandline = IRISH_LANDLINE_PREFIXES.some(prefix => cleaned.startsWith(prefix));

    if (isLandline) {
        // Irish landline numbers are typically 7-9 digits after the area code
        if (cleaned.length < 7 || cleaned.length > 10) {
            return { valid: false, error: 'Invalid landline number length' };
        }
        return { valid: true };
    }

    return { valid: false, error: 'Please enter a valid Irish phone number starting with +353' };
}

/**
 * Formats a phone number to the standard Irish format: +353 XX XXX XXXX
 * 
 * @param phone - The phone number in any format
 * @returns Formatted phone number or the original if invalid
 */
export function formatIrishPhone(phone: string): string {
    if (!phone || phone.trim() === '') {
        return '';
    }

    let cleaned = cleanPhoneNumber(phone);

    // Remove country code if present
    if (cleaned.startsWith('353')) {
        cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('00353')) {
        cleaned = cleaned.substring(5);
    } else if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // If not enough digits, return as is
    if (cleaned.length < 7) {
        return phone;
    }

    // Check if it's a mobile number (2-digit prefix + 7 digits)
    const isMobile = IRISH_MOBILE_PREFIXES.some(prefix => cleaned.startsWith(prefix));

    if (isMobile && cleaned.length === 9) {
        // Format as +353 XX XXX XXXX
        return `+353 ${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
    }

    // For landlines or other formats, just add the country code
    return `+353 ${cleaned}`;
}

/**
 * Normalizes a phone number to E.164 format for storage: +353XXXXXXXXX
 * 
 * @param phone - The phone number in any format
 * @returns E.164 formatted phone number or empty string if invalid
 */
export function normalizeIrishPhone(phone: string): string {
    const validation = validateIrishPhone(phone);
    if (!validation.valid) {
        return '';
    }

    let cleaned = cleanPhoneNumber(phone);

    // Remove country code if present
    if (cleaned.startsWith('353')) {
        cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('00353')) {
        cleaned = cleaned.substring(5);
    } else if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    return `+353${cleaned}`;
}

/**
 * Email validation
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email || email.trim() === '') {
        return { valid: false, error: 'Email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }

    return { valid: true };
}

/**
 * Password validation
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password) {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters' };
    }

    return { valid: true };
}

/**
 * Full name validation
 */
export function validateFullName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim() === '') {
        return { valid: false, error: 'Full name is required' };
    }

    if (name.trim().length < 2) {
        return { valid: false, error: 'Name must be at least 2 characters' };
    }

    return { valid: true };
}
