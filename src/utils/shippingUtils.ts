/**
 * Shipping Utilities — Europe-Only Shipping
 * 
 * Shipping costs are based on real-world average European e-commerce parcel rates (2024-2025).
 * Source: Tembi.io European delivery pricing analysis, EU Cross-Border Magazine.
 * 
 * Costs reflect home delivery for small parcels (< 5kg) within Europe.
 */

// ─── European Countries with Shipping Costs ─────────────────────────────────

export interface EuropeanCountry {
    code: string;
    name: string;
    shippingCost: number; // EUR
    zone: 'domestic' | 'western' | 'southern' | 'northern' | 'central_eastern' | 'remote';
}

export const EUROPEAN_COUNTRIES: EuropeanCountry[] = [
    // Domestic / UK & Ireland
    { code: 'GB', name: 'United Kingdom', shippingCost: 4.99, zone: 'domestic' },
    { code: 'IE', name: 'Ireland', shippingCost: 5.99, zone: 'domestic' },

    // Western Europe — dense logistics networks, lower cost
    { code: 'NL', name: 'Netherlands', shippingCost: 5.99, zone: 'western' },
    { code: 'BE', name: 'Belgium', shippingCost: 5.99, zone: 'western' },
    { code: 'LU', name: 'Luxembourg', shippingCost: 5.99, zone: 'western' },
    { code: 'DE', name: 'Germany', shippingCost: 6.49, zone: 'western' },
    { code: 'FR', name: 'France', shippingCost: 6.99, zone: 'western' },
    { code: 'AT', name: 'Austria', shippingCost: 6.99, zone: 'western' },
    { code: 'MC', name: 'Monaco', shippingCost: 7.49, zone: 'western' },
    { code: 'LI', name: 'Liechtenstein', shippingCost: 7.49, zone: 'western' },
    { code: 'AD', name: 'Andorra', shippingCost: 7.99, zone: 'western' },
    { code: 'SM', name: 'San Marino', shippingCost: 7.99, zone: 'western' },
    { code: 'VA', name: 'Vatican City', shippingCost: 7.99, zone: 'western' },

    // Southern Europe
    { code: 'ES', name: 'Spain', shippingCost: 7.49, zone: 'southern' },
    { code: 'PT', name: 'Portugal', shippingCost: 7.99, zone: 'southern' },
    { code: 'IT', name: 'Italy', shippingCost: 7.49, zone: 'southern' },
    { code: 'GR', name: 'Greece', shippingCost: 8.99, zone: 'southern' },
    { code: 'MT', name: 'Malta', shippingCost: 9.99, zone: 'southern' },
    { code: 'CY', name: 'Cyprus', shippingCost: 9.99, zone: 'southern' },

    // Northern Europe — higher last-mile costs
    { code: 'DK', name: 'Denmark', shippingCost: 7.49, zone: 'northern' },
    { code: 'SE', name: 'Sweden', shippingCost: 8.49, zone: 'northern' },
    { code: 'NO', name: 'Norway', shippingCost: 9.99, zone: 'northern' },
    { code: 'FI', name: 'Finland', shippingCost: 11.99, zone: 'northern' },
    { code: 'IS', name: 'Iceland', shippingCost: 14.99, zone: 'northern' },

    // Central & Eastern Europe — competitive but variable
    { code: 'PL', name: 'Poland', shippingCost: 5.99, zone: 'central_eastern' },
    { code: 'CZ', name: 'Czech Republic', shippingCost: 5.99, zone: 'central_eastern' },
    { code: 'SK', name: 'Slovakia', shippingCost: 5.99, zone: 'central_eastern' },
    { code: 'HU', name: 'Hungary', shippingCost: 6.49, zone: 'central_eastern' },
    { code: 'SI', name: 'Slovenia', shippingCost: 6.49, zone: 'central_eastern' },
    { code: 'HR', name: 'Croatia', shippingCost: 6.99, zone: 'central_eastern' },
    { code: 'EE', name: 'Estonia', shippingCost: 6.99, zone: 'central_eastern' },
    { code: 'LV', name: 'Latvia', shippingCost: 6.99, zone: 'central_eastern' },
    { code: 'LT', name: 'Lithuania', shippingCost: 6.49, zone: 'central_eastern' },
    { code: 'RO', name: 'Romania', shippingCost: 6.99, zone: 'central_eastern' },
    { code: 'BG', name: 'Bulgaria', shippingCost: 7.49, zone: 'central_eastern' },

    // Remote / Non-EU Europe — customs & distance premium
    { code: 'CH', name: 'Switzerland', shippingCost: 11.99, zone: 'remote' },
    { code: 'AL', name: 'Albania', shippingCost: 12.99, zone: 'remote' },
    { code: 'BA', name: 'Bosnia and Herzegovina', shippingCost: 12.99, zone: 'remote' },
    { code: 'RS', name: 'Serbia', shippingCost: 11.99, zone: 'remote' },
    { code: 'ME', name: 'Montenegro', shippingCost: 12.99, zone: 'remote' },
    { code: 'MK', name: 'North Macedonia', shippingCost: 12.99, zone: 'remote' },
    { code: 'MD', name: 'Moldova', shippingCost: 13.99, zone: 'remote' },
    { code: 'UA', name: 'Ukraine', shippingCost: 14.99, zone: 'remote' },
];

// Pre-sorted alphabetically by name for picker display
export const EUROPEAN_COUNTRIES_SORTED = [...EUROPEAN_COUNTRIES].sort((a, b) =>
    a.name.localeCompare(b.name)
);

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Get shipping cost for a given country code.
 * Returns 0 if country not found.
 */
export function getShippingCost(countryCode: string): number {
    const country = EUROPEAN_COUNTRIES.find(c => c.code === countryCode);
    return country?.shippingCost ?? 0;
}

/**
 * Get the country name for a given country code.
 */
export function getCountryName(countryCode: string): string {
    const country = EUROPEAN_COUNTRIES.find(c => c.code === countryCode);
    return country?.name ?? countryCode;
}

/**
 * Get the shipping zone label for display.
 */
export function getZoneLabel(zone: EuropeanCountry['zone']): string {
    const labels: Record<EuropeanCountry['zone'], string> = {
        domestic: 'Domestic',
        western: 'Western Europe',
        southern: 'Southern Europe',
        northern: 'Northern Europe',
        central_eastern: 'Central & Eastern Europe',
        remote: 'Remote Europe',
    };
    return labels[zone] ?? zone;
}

/**
 * Validate that a country code is a valid European country.
 */
export function isValidEuropeanCountry(countryCode: string): boolean {
    return EUROPEAN_COUNTRIES.some(c => c.code === countryCode);
}

// ─── Shipping Status ─────────────────────────────────────────────────────────

export type ShippingStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'returned';

export const SHIPPING_STATUS_CONFIG: Record<ShippingStatus, { label: string; color: string; icon: string }> = {
    pending: { label: 'Pending', color: '#F59E0B', icon: 'clock-outline' },
    processing: { label: 'Processing', color: '#3B82F6', icon: 'package-variant' },
    shipped: { label: 'Shipped', color: '#8B5CF6', icon: 'truck-delivery' },
    delivered: { label: 'Delivered', color: '#10B981', icon: 'check-circle' },
    returned: { label: 'Returned', color: '#EF4444', icon: 'keyboard-return' },
};
