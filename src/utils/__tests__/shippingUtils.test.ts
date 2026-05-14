/**
 * Shipping Utility Tests
 * Tests shipping cost calculations, country validation, zone labels
 */
import {
    getShippingCost,
    getCountryName,
    getZoneLabel,
    isValidEuropeanCountry,
    EUROPEAN_COUNTRIES,
    EUROPEAN_COUNTRIES_SORTED,
    SHIPPING_STATUS_CONFIG,
} from '../shippingUtils';

// ═══════════════════════════════════════════════════════════════════════════
// getShippingCost
// ═══════════════════════════════════════════════════════════════════════════
describe('getShippingCost', () => {
    it('returns 5.99 for Ireland (IE)', () => {
        expect(getShippingCost('IE')).toBe(5.99);
    });

    it('returns 4.99 for United Kingdom (GB)', () => {
        expect(getShippingCost('GB')).toBe(4.99);
    });

    it('returns 6.49 for Germany (DE)', () => {
        expect(getShippingCost('DE')).toBe(6.49);
    });

    it('returns 0 for unknown country (US)', () => {
        expect(getShippingCost('US')).toBe(0);
    });

    it('returns 0 for empty string', () => {
        expect(getShippingCost('')).toBe(0);
    });

    it('returns 0 for lowercase country codes (ie)', () => {
        expect(getShippingCost('ie')).toBe(0);
    });

    it('returns 0 for mixed case country codes (Gb)', () => {
        expect(getShippingCost('Gb')).toBe(0);
    });

    it('returns 0 for non-string types passed at runtime', () => {
        // @ts-ignore - testing runtime behavior
        expect(getShippingCost(null)).toBe(0);
        // @ts-ignore - testing runtime behavior
        expect(getShippingCost(undefined)).toBe(0);
        // @ts-ignore - testing runtime behavior
        expect(getShippingCost(123)).toBe(0);
    });

    it('returns a positive number for every European country', () => {
        EUROPEAN_COUNTRIES.forEach(country => {
            expect(getShippingCost(country.code)).toBeGreaterThan(0);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getCountryName
// ═══════════════════════════════════════════════════════════════════════════
describe('getCountryName', () => {
    it('returns Ireland for IE', () => {
        expect(getCountryName('IE')).toBe('Ireland');
    });

    it('returns Germany for DE', () => {
        expect(getCountryName('DE')).toBe('Germany');
    });

    it('returns the code itself for unknown country', () => {
        expect(getCountryName('US')).toBe('US');
    });

    it('returns the code itself for lowercase country codes (ie)', () => {
        expect(getCountryName('ie')).toBe('ie');
    });

    it('returns the code itself for mixed case country codes (De)', () => {
        expect(getCountryName('De')).toBe('De');
    });

    it('returns the code itself for empty string', () => {
        expect(getCountryName('')).toBe('');
    });

    it('handles non-string types passed at runtime gracefully', () => {
        // @ts-ignore - testing runtime behavior
        expect(getCountryName(null)).toBe(null);
        // @ts-ignore - testing runtime behavior
        expect(getCountryName(undefined)).toBe(undefined);
        // @ts-ignore - testing runtime behavior
        expect(getCountryName(123)).toBe(123);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getZoneLabel
// ═══════════════════════════════════════════════════════════════════════════
describe('getZoneLabel', () => {
    it('returns Domestic for domestic zone', () => {
        expect(getZoneLabel('domestic')).toBe('Domestic');
    });

    it('returns Western Europe for western zone', () => {
        expect(getZoneLabel('western')).toBe('Western Europe');
    });

    it('returns Southern Europe for southern zone', () => {
        expect(getZoneLabel('southern')).toBe('Southern Europe');
    });

    it('returns Northern Europe for northern zone', () => {
        expect(getZoneLabel('northern')).toBe('Northern Europe');
    });

    it('returns Central & Eastern Europe for central_eastern zone', () => {
        expect(getZoneLabel('central_eastern')).toBe('Central & Eastern Europe');
    });

    it('returns Remote Europe for remote zone', () => {
        expect(getZoneLabel('remote')).toBe('Remote Europe');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// isValidEuropeanCountry
// ═══════════════════════════════════════════════════════════════════════════
describe('isValidEuropeanCountry', () => {
    it('returns true for Ireland (IE)', () => {
        expect(isValidEuropeanCountry('IE')).toBe(true);
    });

    it('returns true for Germany (DE)', () => {
        expect(isValidEuropeanCountry('DE')).toBe(true);
    });

    it('returns true for Ukraine (UA)', () => {
        expect(isValidEuropeanCountry('UA')).toBe(true);
    });

    it('returns false for United States (US)', () => {
        expect(isValidEuropeanCountry('US')).toBe(false);
    });

    it('returns false for unknown code (XX)', () => {
        expect(isValidEuropeanCountry('XX')).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isValidEuropeanCountry('')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// EUROPEAN_COUNTRIES_SORTED
// ═══════════════════════════════════════════════════════════════════════════
describe('EUROPEAN_COUNTRIES_SORTED', () => {
    it('is sorted alphabetically by name', () => {
        for (let i = 1; i < EUROPEAN_COUNTRIES_SORTED.length; i++) {
            const prev = EUROPEAN_COUNTRIES_SORTED[i - 1].name;
            const curr = EUROPEAN_COUNTRIES_SORTED[i].name;
            expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
        }
    });

    it('has same length as EUROPEAN_COUNTRIES', () => {
        expect(EUROPEAN_COUNTRIES_SORTED.length).toBe(EUROPEAN_COUNTRIES.length);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SHIPPING_STATUS_CONFIG
// ═══════════════════════════════════════════════════════════════════════════
describe('SHIPPING_STATUS_CONFIG', () => {
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'returned'] as const;

    it('has config for all shipping statuses', () => {
        statuses.forEach(status => {
            expect(SHIPPING_STATUS_CONFIG[status]).toBeDefined();
        });
    });

    it('every status has label, color, and icon', () => {
        statuses.forEach(status => {
            const config = SHIPPING_STATUS_CONFIG[status];
            expect(config.label).toBeDefined();
            expect(config.color).toBeDefined();
            expect(config.icon).toBeDefined();
            expect(typeof config.label).toBe('string');
            expect(typeof config.color).toBe('string');
            expect(typeof config.icon).toBe('string');
        });
    });

    it('colors are valid hex codes', () => {
        statuses.forEach(status => {
            expect(SHIPPING_STATUS_CONFIG[status].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// EUROPEAN_COUNTRIES data integrity
// ═══════════════════════════════════════════════════════════════════════════
describe('EUROPEAN_COUNTRIES data integrity', () => {
    it('every country has a 2-letter code', () => {
        EUROPEAN_COUNTRIES.forEach(c => {
            expect(c.code).toMatch(/^[A-Z]{2}$/);
        });
    });

    it('every country has a non-empty name', () => {
        EUROPEAN_COUNTRIES.forEach(c => {
            expect(c.name.length).toBeGreaterThan(0);
        });
    });

    it('every country has a positive shipping cost', () => {
        EUROPEAN_COUNTRIES.forEach(c => {
            expect(c.shippingCost).toBeGreaterThan(0);
        });
    });

    it('has no duplicate country codes', () => {
        const codes = EUROPEAN_COUNTRIES.map(c => c.code);
        const uniqueCodes = [...new Set(codes)];
        expect(codes.length).toBe(uniqueCodes.length);
    });
});
