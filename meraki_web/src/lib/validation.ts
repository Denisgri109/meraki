/**
 * Validation utilities — ported from meraki-MOBILE/src/utils/validation.ts
 * Kept in sync to guarantee identical registration validation across web & mobile.
 */

// Irish mobile prefixes (after removing the leading 0)
const IRISH_MOBILE_PREFIXES = ['83', '85', '86', '87', '88', '89'];

// Irish landline area codes (after removing the leading 0)
const IRISH_LANDLINE_PREFIXES = [
  '1', '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '402', '404', '41', '42', '43', '44', '45', '46', '47', '49',
  '51', '52', '53', '56', '57', '58', '59', '61', '62', '63',
  '64', '65', '66', '67', '68', '69', '71', '74', '76', '90',
  '91', '93', '94', '95', '96', '97', '98', '99',
];

export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function validateIrishPhone(phone: string): { valid: boolean; error?: string } {
  if (!phone || phone.trim() === '') {
    return { valid: false, error: 'Phone number is required' };
  }

  let cleaned = cleanPhoneNumber(phone);

  if (phone.startsWith('+')) {
    cleaned = cleanPhoneNumber(phone.substring(1));
  }

  if (cleaned.startsWith('353')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('00353')) {
    cleaned = cleaned.substring(5);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  const isMobile = IRISH_MOBILE_PREFIXES.some((prefix) => cleaned.startsWith(prefix));
  if (isMobile) {
    if (cleaned.length !== 9) {
      return { valid: false, error: 'Irish mobile numbers must have 9 digits after the prefix' };
    }
    return { valid: true };
  }

  const isLandline = IRISH_LANDLINE_PREFIXES.some((prefix) => cleaned.startsWith(prefix));
  if (isLandline) {
    if (cleaned.length < 7 || cleaned.length > 10) {
      return { valid: false, error: 'Invalid landline number length' };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Please enter a valid Irish phone number starting with +353' };
}

export function formatIrishPhone(phone: string): string {
  if (!phone || phone.trim() === '') return '';

  let cleaned = cleanPhoneNumber(phone);

  if (cleaned.startsWith('353')) cleaned = cleaned.substring(3);
  else if (cleaned.startsWith('00353')) cleaned = cleaned.substring(5);
  else if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);

  if (cleaned.length < 7) return phone;

  const isMobile = IRISH_MOBILE_PREFIXES.some((prefix) => cleaned.startsWith(prefix));
  if (isMobile && cleaned.length === 9) {
    return `+353 ${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  }
  return `+353 ${cleaned}`;
}

export function normalizeIrishPhone(phone: string): string {
  const validation = validateIrishPhone(phone);
  if (!validation.valid) return '';

  let cleaned = cleanPhoneNumber(phone);
  if (cleaned.startsWith('353')) cleaned = cleaned.substring(3);
  else if (cleaned.startsWith('00353')) cleaned = cleaned.substring(5);
  else if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);

  return `+353${cleaned}`;
}

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

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  return { valid: true };
}

export function validateFullName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Full name is required' };
  }
  if (name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  return { valid: true };
}
