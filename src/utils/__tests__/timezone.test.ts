/**
 * Timezone Utility Tests
 * Tests timezone conversion, formatting, currency, and lookup functions
 */
import {
    utcToZonedTime,
    zonedTimeToUtc,
    formatInTimezone,
    formatAppointmentTime,
    getDeviceTimezone,
    getTimezoneAbbreviation,
    formatCurrency,
    getCountryName,
    getTimezoneLabel,
    COMMON_TIMEZONES,
    SUPPORTED_CURRENCIES,
    COMMON_COUNTRIES,
} from '../timezone';

// ═══════════════════════════════════════════════════════════════════════════
// Data Constants
// ═══════════════════════════════════════════════════════════════════════════
describe('Constants', () => {
    it('COMMON_TIMEZONES is a non-empty array', () => {
        expect(Array.isArray(COMMON_TIMEZONES)).toBe(true);
        expect(COMMON_TIMEZONES.length).toBeGreaterThan(0);
    });

    it('every timezone has value and label', () => {
        COMMON_TIMEZONES.forEach(tz => {
            expect(tz.value).toBeDefined();
            expect(tz.label).toBeDefined();
            expect(typeof tz.value).toBe('string');
            expect(typeof tz.label).toBe('string');
        });
    });

    it('SUPPORTED_CURRENCIES is a non-empty array', () => {
        expect(Array.isArray(SUPPORTED_CURRENCIES)).toBe(true);
        expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(0);
    });

    it('every currency has value, label, and symbol', () => {
        SUPPORTED_CURRENCIES.forEach(c => {
            expect(c.value).toBeDefined();
            expect(c.label).toBeDefined();
            expect(c.symbol).toBeDefined();
        });
    });

    it('COMMON_COUNTRIES is a non-empty array', () => {
        expect(Array.isArray(COMMON_COUNTRIES)).toBe(true);
        expect(COMMON_COUNTRIES.length).toBeGreaterThan(0);
    });

    it('every country has value and label', () => {
        COMMON_COUNTRIES.forEach(c => {
            expect(c.value).toBeDefined();
            expect(c.label).toBeDefined();
        });
    });

    it('includes Ireland in COMMON_COUNTRIES', () => {
        const ireland = COMMON_COUNTRIES.find(c => c.value === 'IE');
        expect(ireland).toBeDefined();
        expect(ireland!.label).toBe('Ireland');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// utcToZonedTime
// ═══════════════════════════════════════════════════════════════════════════
describe('utcToZonedTime', () => {
    it('converts a UTC ISO string to a Date object', () => {
        const result = utcToZonedTime('2025-06-15T12:00:00Z', 'Europe/London');
        expect(result).toBeInstanceOf(Date);
    });

    it('converts a Date object to zoned time', () => {
        const utcDate = new Date('2025-06-15T12:00:00Z');
        const result = utcToZonedTime(utcDate, 'Europe/London');
        expect(result).toBeInstanceOf(Date);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// zonedTimeToUtc
// ═══════════════════════════════════════════════════════════════════════════
describe('zonedTimeToUtc', () => {
    it('returns a Date object', () => {
        const localDate = new Date(2025, 5, 15, 14, 0, 0);
        const result = zonedTimeToUtc(localDate, 'Europe/Dublin');
        expect(result).toBeInstanceOf(Date);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatInTimezone
// ═══════════════════════════════════════════════════════════════════════════
describe('formatInTimezone', () => {
    it('formats UTC date in a given timezone', () => {
        const result = formatInTimezone('2025-06-15T12:00:00Z', 'Europe/London', 'HH:mm');
        expect(typeof result).toBe('string');
        expect(result).toBe('13:00'); // BST = UTC+1 in June
    });

    it('formats with a full date pattern', () => {
        const result = formatInTimezone('2025-01-15T10:00:00Z', 'America/New_York', 'yyyy-MM-dd HH:mm');
        expect(result).toBe('2025-01-15 05:00'); // EST = UTC-5
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatAppointmentTime
// ═══════════════════════════════════════════════════════════════════════════
describe('formatAppointmentTime', () => {
    it('returns single timezone result when no client timezone', () => {
        const result = formatAppointmentTime('2025-06-15T14:00:00Z', 'Europe/London');
        expect(result.masterTime).toBeDefined();
        expect(result.showBothTimes).toBe(false);
    });

    it('returns single timezone when client timezone matches master', () => {
        const result = formatAppointmentTime('2025-06-15T14:00:00Z', 'Europe/London', 'Europe/London');
        expect(result.showBothTimes).toBe(false);
    });

    it('returns both times when different timezones', () => {
        const result = formatAppointmentTime('2025-06-15T14:00:00Z', 'Europe/London', 'America/New_York');
        expect(result.showBothTimes).toBe(true);
        expect(result.clientTime).toBeDefined();
        expect(result.masterTime).not.toBe(result.clientTime);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getDeviceTimezone
// ═══════════════════════════════════════════════════════════════════════════
describe('getDeviceTimezone', () => {
    it('returns a string', () => {
        const tz = getDeviceTimezone();
        expect(typeof tz).toBe('string');
        expect(tz.length).toBeGreaterThan(0);
    });

    it('falls back to UTC if Intl.DateTimeFormat throws an error', () => {
        // Save the original Intl.DateTimeFormat
        const originalDateTimeFormat = Intl.DateTimeFormat;

        try {
            // Mock Intl.DateTimeFormat to throw an error
            const mockDateTimeFormat = jest.fn().mockImplementation(() => {
                throw new Error('Test error');
            });
            global.Intl.DateTimeFormat = mockDateTimeFormat as any;

            const tz = getDeviceTimezone();
            expect(tz).toBe('UTC');
        } finally {
            // Restore the original Intl.DateTimeFormat
            global.Intl.DateTimeFormat = originalDateTimeFormat;
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getTimezoneAbbreviation
// ═══════════════════════════════════════════════════════════════════════════
describe('getTimezoneAbbreviation', () => {
    it('returns a string abbreviation for a valid timezone', () => {
        const abbr = getTimezoneAbbreviation('America/New_York');
        expect(typeof abbr).toBe('string');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatCurrency
// ═══════════════════════════════════════════════════════════════════════════
describe('formatCurrency', () => {
    it('formats EUR with symbol', () => {
        expect(formatCurrency(10.50, 'EUR')).toBe('€10.50');
    });

    it('formats USD with symbol', () => {
        expect(formatCurrency(25, 'USD')).toBe('$25.00');
    });

    it('formats GBP with symbol', () => {
        expect(formatCurrency(99.99, 'GBP')).toBe('£99.99');
    });

    it('formats JPY without decimals', () => {
        expect(formatCurrency(1000, 'JPY')).toBe('¥1,000');
    });

    it('formats KRW without decimals', () => {
        expect(formatCurrency(50000, 'KRW')).toBe('₩50,000');
    });

    it('defaults to EUR when no currency specified', () => {
        expect(formatCurrency(10)).toBe('€10.00');
    });

    it('uses currency code as symbol for unknown currency', () => {
        const result = formatCurrency(10, 'XYZ');
        expect(result).toContain('XYZ');
    });

    it('formats zero correctly', () => {
        expect(formatCurrency(0, 'EUR')).toBe('€0.00');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getCountryName
// ═══════════════════════════════════════════════════════════════════════════
describe('getCountryName', () => {
    it('returns Ireland for IE', () => {
        expect(getCountryName('IE')).toBe('Ireland');
    });

    it('returns United States for US', () => {
        expect(getCountryName('US')).toBe('United States');
    });

    it('returns the code itself for unknown country', () => {
        expect(getCountryName('XX')).toBe('XX');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getTimezoneLabel
// ═══════════════════════════════════════════════════════════════════════════
describe('getTimezoneLabel', () => {
    it('returns label for Europe/London', () => {
        expect(getTimezoneLabel('Europe/London')).toBe('London (GMT/BST)');
    });

    it('returns label for America/New_York', () => {
        expect(getTimezoneLabel('America/New_York')).toBe('New York (EST/EDT)');
    });

    it('returns value itself for unknown timezone', () => {
        expect(getTimezoneLabel('Unknown/Zone')).toBe('Unknown/Zone');
    });
});
