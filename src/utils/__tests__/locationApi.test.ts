import { getCountryByCode, getAllCountries, getCitiesOfCountry, getStatesOfCountry, getCitiesOfState, filterCountries, getTimezoneFromCountry, Country } from '../locationApi';

describe('locationApi', () => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;

    beforeEach(() => {
        global.fetch = jest.fn();
        console.error = jest.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        console.error = originalConsoleError;
        jest.clearAllMocks();
    });

    describe('getCountryByCode', () => {
        const mockCountry = {
            id: 104,
            name: "Ireland",
            iso2: "IE",
            iso3: "IRL",
            phonecode: "353",
            capital: "Dublin",
            currency: "EUR",
            currency_symbol: "€",
            timezones: [
                {
                    zoneName: "Europe/Dublin",
                    gmtOffset: 0,
                    gmtOffsetName: "UTC±00",
                    abbreviation: "GMT",
                    tzName: "Greenwich Mean Time"
                }
            ]
        };

        it('should return country details on successful fetch', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockCountry,
            });

            const result = await getCountryByCode('IE');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/IE',
                { headers: { 'X-CSCAPI-KEY': expect.any(String) } }
            );
            expect(result).toEqual(mockCountry);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should return null and log error if response is not ok', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
            });

            const result = await getCountryByCode('IE');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/IE',
                { headers: { 'X-CSCAPI-KEY': expect.any(String) } }
            );
            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching country:',
                expect.any(Error)
            );
            const errorArg = (console.error as jest.Mock).mock.calls[0][1];
            expect(errorArg.message).toBe('Failed to fetch country');
        });

        it('should return null and log error if response.json() throws an error (e.g. malformed JSON)', async () => {
            const jsonError = new SyntaxError('Unexpected token < in JSON');
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => { throw jsonError; },
            });

            const result = await getCountryByCode('IE');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/IE',
                { headers: { 'X-CSCAPI-KEY': expect.any(String) } }
            );
            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching country:',
                jsonError
            );
        });

        it('should return null and log error if fetch throws an exception', async () => {
            const networkError = new Error('Network error');
            (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

            const result = await getCountryByCode('IE');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/IE',
                { headers: { 'X-CSCAPI-KEY': expect.any(String) } }
            );
            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching country:',
                networkError
            );
        });
    });

    describe('getAllCountries', () => {
        it('returns countries on successful response', async () => {
            const mockCountries = [
                { id: 1, name: 'Country 1', iso2: 'C1' },
                { id: 2, name: 'Country 2', iso2: 'C2' },
            ];

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockCountries,
            });

            const result = await getAllCountries();

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries',
                expect.any(Object)
            );
            expect(result).toEqual(mockCountries);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('returns empty array and logs error on non-ok response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await getAllCountries();

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries',
                expect.any(Object)
            );
            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching countries:',
                expect.objectContaining({ message: 'Failed to fetch countries' })
            );
        });

        it('returns empty array and logs error on network exception', async () => {
            const networkError = new Error('Network failure');
            (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

            const result = await getAllCountries();

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries',
                expect.any(Object)
            );
            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching countries:',
                networkError
            );
        });
    });

    describe('getCitiesOfCountry', () => {
        it('returns cities on successful response', async () => {
            const mockCities = [
                { id: 1, name: 'City 1', country_code: 'IE' },
                { id: 2, name: 'City 2', country_code: 'IE' },
            ];

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockCities,
            });

            const result = await getCitiesOfCountry('IE');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/IE/cities',
                expect.any(Object)
            );
            expect(result).toEqual(mockCities);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('returns empty array and logs error on non-ok response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await getCitiesOfCountry('IE');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/IE/cities',
                expect.any(Object)
            );
            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching cities:',
                expect.objectContaining({ message: 'Failed to fetch cities' })
            );
        });

        it('returns empty array and logs error on network exception', async () => {
            const networkError = new Error('Network failure');
            (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

            const result = await getCitiesOfCountry('IE');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/IE/cities',
                expect.any(Object)
            );
            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching cities:',
                networkError
            );
        });
    });

    describe('getCitiesOfState', () => {
        const mockCities = [
            { id: 1, name: 'City 1', state_code: 'S1', country_code: 'C1', latitude: '0', longitude: '0' },
            { id: 2, name: 'City 2', state_code: 'S1', country_code: 'C1', latitude: '0', longitude: '0' },
        ];

        it('returns cities on successful response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockCities,
            });

            const result = await getCitiesOfState('C1', 'S1');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/C1/states/S1/cities',
                expect.any(Object)
            );
            expect(result).toEqual(mockCities);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('returns empty array and logs error on non-ok response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await getCitiesOfState('C1', 'S1');

            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching cities:',
                expect.objectContaining({ message: 'Failed to fetch cities' })
            );
        });

        it('returns empty array and logs error on network exception', async () => {
            const networkError = new Error('Network failure');
            (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

            const result = await getCitiesOfState('C1', 'S1');

            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching cities:',
                networkError
            );
        });
    });

    describe('getStatesOfCountry', () => {
        const mockStates = [
            { id: 1, name: 'State 1', iso2: 'S1', country_code: 'C1' },
            { id: 2, name: 'State 2', iso2: 'S2', country_code: 'C1' },
        ];

        it('should return states list on successful fetch', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockStates,
            });

            const result = await getStatesOfCountry('C1');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/C1/states',
                expect.any(Object)
            );
            expect(result).toEqual(mockStates);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should return empty array and log error if response is not ok', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await getStatesOfCountry('C1');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/C1/states',
                expect.any(Object)
            );
            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching states:',
                expect.objectContaining({ message: 'Failed to fetch states' })
            );
        });

        it('should return empty array and log error if fetch throws an exception', async () => {
            const networkError = new Error('Network error');
            (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

            const result = await getStatesOfCountry('C1');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.countrystatecity.in/v1/countries/C1/states',
                expect.any(Object)
            );
            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(
                'Error fetching states:',
                networkError
            );
        });
    });

    describe('filterCountries', () => {
        const mockCountries: Country[] = [
            { id: 1, name: 'United States', iso2: 'US', iso3: 'USA', phonecode: '1', capital: 'Washington', currency: 'USD', currency_symbol: '$', timezones: [] },
            { id: 2, name: 'United Kingdom', iso2: 'GB', iso3: 'GBR', phonecode: '44', capital: 'London', currency: 'GBP', currency_symbol: '£', timezones: [] },
            { id: 3, name: 'Canada', iso2: 'CA', iso3: 'CAN', phonecode: '1', capital: 'Ottawa', currency: 'CAD', currency_symbol: '$', timezones: [] },
            { id: 4, name: 'Australia', iso2: 'AU', iso3: 'AUS', phonecode: '61', capital: 'Canberra', currency: 'AUD', currency_symbol: '$', timezones: [] },
            { id: 5, name: 'Germany', iso2: 'DE', iso3: 'DEU', phonecode: '49', capital: 'Berlin', currency: 'EUR', currency_symbol: '€', timezones: [] },
        ];

        it('returns all countries when the query is empty', () => {
            expect(filterCountries(mockCountries, '')).toEqual(mockCountries);
        });

        it('returns all countries when the query is whitespace only', () => {
            expect(filterCountries(mockCountries, '   ')).toEqual(mockCountries);
        });

        it('filters correctly by partial, case-insensitive name match', () => {
            const result = filterCountries(mockCountries, 'united');
            expect(result.length).toBe(2);
            expect(result.map(c => c.name)).toEqual(['United States', 'United Kingdom']);

            const result2 = filterCountries(mockCountries, 'CAN');
            expect(result2.length).toBe(1);
            expect(result2[0].name).toBe('Canada');
        });

        it('filters correctly by exact, case-insensitive iso2 match', () => {
            // 'us' also matches 'United States' and 'Australia' because of 'us' in 'Australia'
            // To test *exact* iso2 match prioritizing or isolating, we can try something else or acknowledge both match
            const result = filterCountries(mockCountries, 'us');
            expect(result.length).toBe(2);
            expect(result.map(c => c.name)).toEqual(['United States', 'Australia']);

            const result2 = filterCountries(mockCountries, 'DE');
            expect(result2.length).toBe(1);
            expect(result2[0].name).toBe('Germany');
        });

        it('handles trailing and leading whitespace in the query properly', () => {
            const result = filterCountries(mockCountries, ' canada  ');
            expect(result.length).toBe(1);
            expect(result[0].name).toBe('Canada');
        });

        it('returns an empty array when there are no matches', () => {
            const result = filterCountries(mockCountries, 'nonexistent');
            expect(result.length).toBe(0);
        });
    });

    describe('getTimezoneFromCountry', () => {
        it('should return the first zoneName if timezones exist and is not empty', () => {
            const mockCountryWithTimezone = {
                id: 104,
                name: "Ireland",
                iso2: "IE",
                iso3: "IRL",
                phonecode: "353",
                capital: "Dublin",
                currency: "EUR",
                currency_symbol: "€",
                timezones: [
                    {
                        zoneName: "Europe/Dublin",
                        gmtOffset: 0,
                        gmtOffsetName: "UTC±00",
                        abbreviation: "GMT",
                        tzName: "Greenwich Mean Time"
                    },
                    {
                        zoneName: "Europe/London",
                        gmtOffset: 0,
                        gmtOffsetName: "UTC±00",
                        abbreviation: "GMT",
                        tzName: "Greenwich Mean Time"
                    }
                ]
            } as Country;

            const result = getTimezoneFromCountry(mockCountryWithTimezone);
            expect(result).toBe("Europe/Dublin");
        });

        it('should return null if timezones array is empty', () => {
            const mockCountryEmptyTimezones = {
                id: 1,
                name: 'Test',
                iso2: 'TS',
                iso3: 'TST',
                phonecode: '1',
                capital: 'Test City',
                currency: 'TST',
                currency_symbol: '$',
                timezones: []
            } as Country;

            const result = getTimezoneFromCountry(mockCountryEmptyTimezones);
            expect(result).toBeNull();
        });

        it('should return null if timezones is undefined', () => {
            const mockCountryUndefinedTimezones = {
                id: 1,
                name: 'Test',
                iso2: 'TS',
                iso3: 'TST',
                phonecode: '1',
                capital: 'Test City',
                currency: 'TST',
                currency_symbol: '$'
            } as unknown as Country;

            const result = getTimezoneFromCountry(mockCountryUndefinedTimezones);
            expect(result).toBeNull();
        });
    });
});
