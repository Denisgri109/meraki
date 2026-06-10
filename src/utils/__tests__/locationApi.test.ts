import { getCountryByCode, getAllCountries, getCitiesOfCountry, getStatesOfCountry } from '../locationApi';

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
});
