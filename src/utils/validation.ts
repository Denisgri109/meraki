export interface CountryConfig {
    name: string;
    code: string;
    callingCode: string;
    flag: string;
    placeholder: string;
    validate: (localNumber: string) => { valid: boolean; error?: string };
    format: (localNumber: string) => string;
}

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
    {
        name: 'Ireland',
        code: 'IE',
        callingCode: '+353',
        flag: '🇮🇪',
        placeholder: '87 123 4567',
        validate: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
            
            const isMobile = ['83', '85', '86', '87', '88', '89'].some(p => cleaned.startsWith(p));
            if (isMobile) {
                if (cleaned.length !== 9) return { valid: false, error: 'Irish mobile numbers must have 9 digits after the prefix' };
                return { valid: true };
            }
            
            const isLandline = [
                '1', '21', '22', '23', '24', '25', '26', '27', '28', '29',
                '402', '404', '41', '42', '43', '44', '45', '46', '47', '49',
                '51', '52', '53', '56', '57', '58', '59', '61', '62', '63',
                '64', '65', '66', '67', '68', '69', '71', '74', '76', '90',
                '91', '93', '94', '95', '96', '97', '98', '99'
            ].some(p => cleaned.startsWith(p));
            
            if (isLandline) {
                if (cleaned.length < 7 || cleaned.length > 10) {
                    return { valid: false, error: 'Invalid landline number length' };
                }
                return { valid: true };
            }
            
            return { valid: false, error: 'Please enter a valid Irish phone number starting with +353' };
        },
        format: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
            if (cleaned.length < 7) return local;
            const isMobile = ['83', '85', '86', '87', '88', '89'].some(p => cleaned.startsWith(p));
            if (isMobile && cleaned.length === 9) {
                return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
            }
            return cleaned;
        }
    },
    {
        name: 'United Kingdom',
        code: 'GB',
        callingCode: '+44',
        flag: '🇬🇧',
        placeholder: '7700 900000',
        validate: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
            
            if (cleaned.startsWith('7')) {
                if (cleaned.length !== 10) return { valid: false, error: 'UK mobile numbers must be 10 digits' };
                return { valid: true };
            }
            if (['1', '2', '3'].some(p => cleaned.startsWith(p))) {
                if (cleaned.length < 9 || cleaned.length > 10) {
                    return { valid: false, error: 'Invalid UK landline length (9-10 digits)' };
                }
                return { valid: true };
            }
            return { valid: false, error: 'UK numbers must start with 7 (mobile) or 1, 2, 3 (landline)' };
        },
        format: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
            if (cleaned.length === 10) {
                return `${cleaned.substring(0, 4)} ${cleaned.substring(4)}`;
            }
            return cleaned;
        }
    },
    {
        name: 'United States/Canada',
        code: 'US',
        callingCode: '+1',
        flag: '🇺🇸',
        placeholder: '201 555 0123',
        validate: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.length === 11 && cleaned.startsWith('1')) cleaned = cleaned.substring(1);
            
            if (cleaned.length !== 10) return { valid: false, error: 'US/Canada phone numbers must be 10 digits' };
            if (cleaned[0] === '0' || cleaned[0] === '1') return { valid: false, error: 'Area code cannot start with 0 or 1' };
            if (cleaned[3] === '0' || cleaned[3] === '1') return { valid: false, error: 'Exchange code cannot start with 0 or 1' };
            return { valid: true };
        },
        format: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.length === 11 && cleaned.startsWith('1')) cleaned = cleaned.substring(1);
            if (cleaned.length === 10) {
                return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
            }
            return cleaned;
        }
    },
    {
        name: 'Germany',
        code: 'DE',
        callingCode: '+49',
        flag: '🇩🇪',
        placeholder: '170 1234567',
        validate: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
            
            if (cleaned.length < 9 || cleaned.length > 12) {
                return { valid: false, error: 'German phone numbers must be 9-12 digits' };
            }
            return { valid: true };
        },
        format: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
            if (cleaned.length >= 3) {
                return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
            }
            return cleaned;
        }
    },
    {
        name: 'France',
        code: 'FR',
        callingCode: '+33',
        flag: '🇫🇷',
        placeholder: '6 12 34 56 78',
        validate: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
            
            if (cleaned.length !== 9) return { valid: false, error: 'French phone numbers must be 9 digits' };
            if (!['1', '2', '3', '4', '5', '6', '7', '9'].some(p => cleaned.startsWith(p))) {
                return { valid: false, error: 'Invalid French number format' };
            }
            return { valid: true };
        },
        format: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
            if (cleaned.length === 9) {
                return `${cleaned.substring(0, 1)} ${cleaned.substring(1, 3)} ${cleaned.substring(3, 5)} ${cleaned.substring(5, 7)} ${cleaned.substring(7)}`;
            }
            return cleaned;
        }
    },
    {
        name: 'Spain',
        code: 'ES',
        callingCode: '+34',
        flag: '🇪🇸',
        placeholder: '612 345 678',
        validate: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.length !== 9) return { valid: false, error: 'Spanish phone numbers must be 9 digits' };
            if (!['6', '7', '8', '9'].some(p => cleaned.startsWith(p))) {
                return { valid: false, error: 'Spanish numbers must start with 6, 7, 8, or 9' };
            }
            return { valid: true };
        },
        format: (local) => {
            let cleaned = local.replace(/\D/g, '');
            if (cleaned.length === 9) {
                return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
            }
            return cleaned;
        }
    }
];

export function cleanPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
}

export function parsePhoneNumber(phone: string): { countryCode: string; localNumber: string } {
    if (!phone) return { countryCode: 'IE', localNumber: '' };
    
    let cleaned = phone.replace(/\s+/g, '');
    
    if (cleaned.startsWith('00')) {
        cleaned = '+' + cleaned.substring(2);
    }
    
    const sortedCountries = [...SUPPORTED_COUNTRIES].sort((a, b) => b.callingCode.length - a.callingCode.length);
    
    for (const country of sortedCountries) {
        if (cleaned.startsWith(country.callingCode)) {
            return {
                countryCode: country.code,
                localNumber: cleaned.substring(country.callingCode.length)
            };
        }
        const rawCode = country.callingCode.replace('+', '');
        if (cleaned.startsWith(rawCode) && !cleaned.startsWith('+')) {
            return {
                countryCode: country.code,
                localNumber: cleaned.substring(rawCode.length)
            };
        }
    }
    
    if (cleaned.startsWith('0')) {
        return {
            countryCode: 'IE',
            localNumber: cleaned.substring(1)
        };
    }
    
    return {
        countryCode: 'IE',
        localNumber: cleaned
    };
}

export function validatePhone(phone: string, countryCode: string): { valid: boolean; error?: string } {
    if (!phone || phone.trim() === '') {
        return { valid: false, error: 'Phone number is required' };
    }
    const config = SUPPORTED_COUNTRIES.find(c => c.code === countryCode);
    if (!config) return { valid: false, error: 'Unsupported country code' };
    return config.validate(phone);
}

export function formatPhone(phone: string, countryCode: string): string {
    if (!phone || phone.trim() === '') return '';
    const config = SUPPORTED_COUNTRIES.find(c => c.code === countryCode);
    if (!config) return phone;
    return config.format(phone);
}

export function normalizePhone(localPhone: string, countryCode: string): string {
    const config = SUPPORTED_COUNTRIES.find(c => c.code === countryCode);
    if (!config) return '';
    const validation = config.validate(localPhone);
    if (!validation.valid) return '';
    let cleaned = localPhone.replace(/\D/g, '');
    if (config.code === 'IE' && cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (config.code === 'GB' && cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (config.code === 'DE' && cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (config.code === 'FR' && cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (config.code === 'US' && cleaned.length === 11 && cleaned.startsWith('1')) cleaned = cleaned.substring(1);
    return `${config.callingCode}${cleaned}`;
}

export function validateIrishPhone(phone: string): { valid: boolean; error?: string } {
    if (!phone || phone.trim() === '') {
        return { valid: false, error: 'Phone number is required' };
    }
    const parsed = parsePhoneNumber(phone);
    if (parsed.countryCode !== 'IE') {
        return { valid: false, error: 'Please enter a valid Irish phone number starting with +353' };
    }
    const ieConfig = SUPPORTED_COUNTRIES.find(c => c.code === 'IE')!;
    return ieConfig.validate(parsed.localNumber);
}

export function formatIrishPhone(phone: string): string {
    if (!phone || phone.trim() === '') return '';
    const parsed = parsePhoneNumber(phone);
    if (parsed.countryCode !== 'IE') return phone;
    const ieConfig = SUPPORTED_COUNTRIES.find(c => c.code === 'IE')!;
    let cleaned = parsed.localNumber.replace(/\D/g, '');
    if (cleaned.length < 7) return phone;
    return `${ieConfig.callingCode} ${ieConfig.format(parsed.localNumber)}`;
}

export function normalizeIrishPhone(phone: string): string {
    const parsed = parsePhoneNumber(phone);
    if (parsed.countryCode !== 'IE') return '';
    const ieConfig = SUPPORTED_COUNTRIES.find(c => c.code === 'IE')!;
    const validation = ieConfig.validate(parsed.localNumber);
    if (!validation.valid) return '';
    let cleaned = parsed.localNumber.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    return `${ieConfig.callingCode}${cleaned}`;
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
