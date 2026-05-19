// Location API utilities using CountryStateCity API
// API Documentation: https://countrystatecity.in/docs/

const API_BASE_URL = 'https://api.countrystatecity.in/v1';

const API_KEY = process.env.EXPO_PUBLIC_COUNTRY_STATE_CITY_API_KEY || ''; // Get free key from https://countrystatecity.in/

if (!API_KEY) {
    console.warn('EXPO_PUBLIC_COUNTRY_STATE_CITY_API_KEY is not set. Location API requests may fail.');
}

export interface Country {
    id: number;
    name: string;
    iso2: string;
    iso3: string;
    phonecode: string;
    capital: string;
    currency: string;
    currency_symbol: string;
    timezones: Array<{
        zoneName: string;
        gmtOffset: number;
        gmtOffsetName: string;
        abbreviation: string;
        tzName: string;
    }>;
}

export interface State {
    id: number;
    name: string;
    iso2: string;
    country_code: string;
    country_id: number;
}

export interface City {
    id: number;
    name: string;
    state_id: number;
    state_code: string;
    state_name: string;
    country_id: number;
    country_code: string;
    country_name: string;
    latitude: string;
    longitude: string;
}

const headers = {
    'X-CSCAPI-KEY': API_KEY,
};

/**
 * Get all countries
 */
export async function getAllCountries(): Promise<Country[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/countries`, { headers });
        if (!response.ok) throw new Error('Failed to fetch countries');
        return await response.json();
    } catch (error) {
        console.error('Error fetching countries:', error);
        return [];
    }
}

/**
 * Get country details by ISO2 code
 */
export async function getCountryByCode(iso2: string): Promise<Country | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/countries/${iso2}`, { headers });
        if (!response.ok) throw new Error('Failed to fetch country');
        return await response.json();
    } catch (error) {
        console.error('Error fetching country:', error);
        return null;
    }
}

/**
 * Get all states/provinces in a country
 */
export async function getStatesOfCountry(countryCode: string): Promise<State[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/countries/${countryCode}/states`, { headers });
        if (!response.ok) throw new Error('Failed to fetch states');
        return await response.json();
    } catch (error) {
        console.error('Error fetching states:', error);
        return [];
    }
}

/**
 * Get all cities in a country (can be large!)
 */
export async function getCitiesOfCountry(countryCode: string): Promise<City[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/countries/${countryCode}/cities`, { headers });
        if (!response.ok) throw new Error('Failed to fetch cities');
        return await response.json();
    } catch (error) {
        console.error('Error fetching cities:', error);
        return [];
    }
}

/**
 * Get cities in a specific state/province
 */
export async function getCitiesOfState(countryCode: string, stateCode: string): Promise<City[]> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/countries/${countryCode}/states/${stateCode}/cities`,
            { headers }
        );
        if (!response.ok) throw new Error('Failed to fetch cities');
        return await response.json();
    } catch (error) {
        console.error('Error fetching cities:', error);
        return [];
    }
}

/**
 * Get timezone from country data
 */
export function getTimezoneFromCountry(country: Country): string | null {
    if (country.timezones && country.timezones.length > 0) {
        return country.timezones[0].zoneName;
    }
    return null;
}

/**
 * Search countries by name (client-side filter)
 */
export function filterCountries(countries: Country[], query: string): Country[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return countries;
    return countries.filter(c =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.iso2.toLowerCase() === lowerQuery
    );
}

/**
 * Search cities by name (client-side filter)
 */
export function filterCities(cities: City[], query: string): City[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return cities.slice(0, 50); // Limit initial results
    return cities.filter(c =>
        c.name.toLowerCase().includes(lowerQuery)
    ).slice(0, 50); // Limit results for performance
}
