import { getAllCountries, Country } from '../locationApi';

// Mock global fetch
global.fetch = jest.fn();

describe('locationApi - getAllCountries', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        // Spy on console.error to suppress error output in tests and verify calls
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore console.error after each test
        consoleErrorSpy.mockRestore();
    });

    it('should successfully fetch and return countries', async () => {
        // Mock data
        const mockCountries: Country[] = [
            {
                id: 1,
                name: 'United States',
                iso2: 'US',
                iso3: 'USA',
                phonecode: '1',
                capital: 'Washington',
                currency: 'USD',
                currency_symbol: '$',
                timezones: [
                    {
                        zoneName: 'America/New_York',
                        gmtOffset: -18000,
                        gmtOffsetName: 'UTC-05:00',
                        abbreviation: 'EST',
                        tzName: 'Eastern Standard Time',
                    },
                ],
            },
        ];

        // Setup successful fetch response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockCountries,
        });

        // Call the function
        const countries = await getAllCountries();

        // Assertions
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.countrystatecity.in/v1/countries',
            {
                headers: {
                    'X-CSCAPI-KEY': 'dccce75f424b5c7e1da7b0599fafa497a1d1cb3de3f0fa1324f17421b32769dd',
                },
            }
        );
        expect(countries).toEqual(mockCountries);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return an empty array and log error when response is not ok', async () => {
        // Setup failed fetch response (e.g., 404, 500)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
        });

        // Call the function
        const countries = await getAllCountries();

        // Assertions
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(countries).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Error fetching countries:',
            expect.any(Error)
        );
        expect(consoleErrorSpy.mock.calls[0][1].message).toBe('Failed to fetch countries');
    });

    it('should return an empty array and log error when network request fails', async () => {
        // Setup fetch to throw a network error
        const networkError = new Error('Network timeout');
        (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

        // Call the function
        const countries = await getAllCountries();

        // Assertions
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(countries).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Error fetching countries:',
            networkError
        );
    });
});
