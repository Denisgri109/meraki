import { getCountryByCode } from '../locationApi';

describe('locationApi', () => {
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

        const originalFetch = global.fetch;
        const originalConsoleError = console.error;

        beforeEach(() => {
            global.fetch = jest.fn();
            console.error = jest.fn(); // Mock console.error to keep test output clean
        });

        afterEach(() => {
            global.fetch = originalFetch;
            console.error = originalConsoleError;
            jest.clearAllMocks();
        });

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
});
