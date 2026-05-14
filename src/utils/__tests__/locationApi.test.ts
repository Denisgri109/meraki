import { getAllCountries } from '../locationApi';

// Mock console.error to avoid cluttering test output and to assert on it
const originalConsoleError = console.error;

describe('locationApi', () => {
    beforeEach(() => {
        // Reset fetch mock before each test
        global.fetch = jest.fn();
        console.error = jest.fn();
    });

    afterEach(() => {
        // Restore console.error
        console.error = originalConsoleError;
        jest.restoreAllMocks();
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
                expect.any(Error)
            );
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
});
