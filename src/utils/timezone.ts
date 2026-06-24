/**
 * Timezone utility functions for global marketplace support
 * All appointments are stored in UTC and converted to local timezones for display
 */

import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';

// Common timezones for picker
export const COMMON_TIMEZONES = [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
    { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { value: 'America/New_York', label: 'New York (EST/EDT)' },
    { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
    { value: 'America/Denver', label: 'Denver (MST/MDT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
    { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
];

// Supported currencies
export const SUPPORTED_CURRENCIES = [
    { value: 'EUR', label: '€ Euro (EUR)', symbol: '€' },
    { value: 'USD', label: '$ US Dollar (USD)', symbol: '$' },
    { value: 'GBP', label: '£ British Pound (GBP)', symbol: '£' },
    { value: 'CAD', label: '$ Canadian Dollar (CAD)', symbol: 'C$' },
    { value: 'AUD', label: '$ Australian Dollar (AUD)', symbol: 'A$' },
    { value: 'CHF', label: 'Fr Swiss Franc (CHF)', symbol: 'Fr' },
    { value: 'JPY', label: '¥ Japanese Yen (JPY)', symbol: '¥' },
    { value: 'CNY', label: '¥ Chinese Yuan (CNY)', symbol: '¥' },
    { value: 'KRW', label: '₩ Korean Won (KRW)', symbol: '₩' },
    { value: 'SGD', label: '$ Singapore Dollar (SGD)', symbol: 'S$' },
    { value: 'AED', label: 'د.إ UAE Dirham (AED)', symbol: 'د.إ' },
    { value: 'BRL', label: 'R$ Brazilian Real (BRL)', symbol: 'R$' },
    { value: 'RUB', label: '₽ Russian Ruble (RUB)', symbol: '₽' },
];

// Common countries for shipping
export const COMMON_COUNTRIES = [
    { value: 'GB', label: 'United Kingdom' },
    { value: 'US', label: 'United States' },
    { value: 'DE', label: 'Germany' },
    { value: 'FR', label: 'France' },
    { value: 'ES', label: 'Spain' },
    { value: 'IT', label: 'Italy' },
    { value: 'NL', label: 'Netherlands' },
    { value: 'BE', label: 'Belgium' },
    { value: 'AT', label: 'Austria' },
    { value: 'CH', label: 'Switzerland' },
    { value: 'PL', label: 'Poland' },
    { value: 'PT', label: 'Portugal' },
    { value: 'IE', label: 'Ireland' },
    { value: 'SE', label: 'Sweden' },
    { value: 'DK', label: 'Denmark' },
    { value: 'NO', label: 'Norway' },
    { value: 'FI', label: 'Finland' },
    { value: 'CA', label: 'Canada' },
    { value: 'AU', label: 'Australia' },
    { value: 'NZ', label: 'New Zealand' },
    { value: 'JP', label: 'Japan' },
    { value: 'SG', label: 'Singapore' },
    { value: 'AE', label: 'United Arab Emirates' },
    { value: 'BR', label: 'Brazil' },
    { value: 'RU', label: 'Russia' },
    { value: 'CN', label: 'China' },
    { value: 'KR', label: 'South Korea' },
    { value: 'IN', label: 'India' },
    { value: 'MX', label: 'Mexico' },
    { value: 'ZA', label: 'South Africa' },
];

// O(1) Lookup Maps for Performance Optimization
export const TIMEZONE_MAP = COMMON_TIMEZONES.reduce((acc, tz) => {
    acc[tz.value] = tz;
    return acc;
}, {} as Record<string, typeof COMMON_TIMEZONES[0]>);

export const CURRENCY_MAP = SUPPORTED_CURRENCIES.reduce((acc, curr) => {
    acc[curr.value] = curr;
    return acc;
}, {} as Record<string, typeof SUPPORTED_CURRENCIES[0]>);

export const COUNTRY_MAP = COMMON_COUNTRIES.reduce((acc, country) => {
    acc[country.value] = country;
    return acc;
}, {} as Record<string, typeof COMMON_COUNTRIES[0]>);

/**
 * Convert a UTC date string to a zoned time in the specified timezone
 */
export function utcToZonedTime(utcDate: string | Date, timezone: string): Date {
    const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
    return toZonedTime(date, timezone);
}

/**
 * Convert a local time in a specific timezone to UTC
 */
export function zonedTimeToUtc(localDate: Date, timezone: string): Date {
    return fromZonedTime(localDate, timezone);
}

/**
 * Format a UTC date in a specific timezone
 */
export function formatInTimezone(
    utcDate: string | Date,
    timezone: string,
    formatString: string
): string {
    const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
    const zonedDate = toZonedTime(date, timezone);
    return formatTz(zonedDate, formatString, { timeZone: timezone });
}

/**
 * Format appointment time for display, showing both Master's timezone and client's local time
 */
export function formatAppointmentTime(
    utcStartTime: string,
    masterTimezone: string,
    clientTimezone?: string,
    formatString: string = 'h:mm a'
): { masterTime: string; clientTime?: string; showBothTimes: boolean } {
    const masterTime = formatInTimezone(utcStartTime, masterTimezone, formatString);

    if (!clientTimezone || clientTimezone === masterTimezone) {
        return { masterTime, showBothTimes: false };
    }

    const clientTime = formatInTimezone(utcStartTime, clientTimezone, formatString);

    // Only show both times if they're different
    if (masterTime === clientTime) {
        return { masterTime, showBothTimes: false };
    }

    return { masterTime, clientTime, showBothTimes: true };
}

/**
 * Get the device's timezone (for React Native)
 * Falls back to UTC if unable to detect
 */
export function getDeviceTimezone(): string {
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/**
 * Get timezone abbreviation for display
 */
export function getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
    try {
        return formatTz(toZonedTime(date, timezone), 'zzz', { timeZone: timezone });
    } catch {
        return '';
    }
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currencyCode: string = 'EUR'): string {
    const currency = CURRENCY_MAP[currencyCode];
    const symbol = currency?.symbol || currencyCode;

    // Format based on currency
    if (currencyCode === 'JPY' || currencyCode === 'KRW') {
        // No decimal places for these currencies
        return `${symbol}${Math.round(amount).toLocaleString()}`;
    }

    return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Get country name from code
 */
export function getCountryName(countryCode: string): string {
    const country = COUNTRY_MAP[countryCode];
    return country?.label || countryCode;
}

/**
 * Get timezone label from value
 */
export function getTimezoneLabel(timezoneValue: string): string {
    const tz = TIMEZONE_MAP[timezoneValue];
    return tz?.label || timezoneValue;
}
