import { haversineDistanceKm, isMasterWithinRange } from '../distance';

describe('haversineDistanceKm', () => {
    it('returns 0 for the same coordinates', () => {
        const lat = 40.7128;
        const lon = -74.0060;
        const distance = haversineDistanceKm(lat, lon, lat, lon);
        expect(distance).toBe(0);
    });

    it('calculates the approximate distance between New York and London', () => {
        // NY: 40.7128° N, 74.0060° W
        const nyLat = 40.7128;
        const nyLon = -74.0060;
        // London: 51.5074° N, 0.1278° W
        const lonLat = 51.5074;
        const lonLon = -0.1278;

        const distance = haversineDistanceKm(nyLat, nyLon, lonLat, lonLon);
        // Distance is ~5570 km. We check within a 5% margin (5200 to 5900).
        expect(distance).toBeGreaterThan(5200);
        expect(distance).toBeLessThan(5900);
    });

    it('calculates the approximate distance between San Francisco and Los Angeles', () => {
        // SF: 37.7749° N, 122.4194° W
        const sfLat = 37.7749;
        const sfLon = -122.4194;
        // LA: 34.0522° N, 118.2437° W
        const laLat = 34.0522;
        const laLon = -118.2437;

        const distance = haversineDistanceKm(sfLat, sfLon, laLat, laLon);
        // Distance is ~559 km. Check within a small margin (500 to 600).
        expect(distance).toBeGreaterThan(500);
        expect(distance).toBeLessThan(600);
    });

    it('handles negative coordinates correctly', () => {
        // Sydney: 33.8688° S, 151.2093° E
        const sydLat = -33.8688;
        const sydLon = 151.2093;
        // Melbourne: 37.8136° S, 144.9631° E
        const melLat = -37.8136;
        const melLon = 144.9631;

        const distance = haversineDistanceKm(sydLat, sydLon, melLat, melLon);
        // Distance is ~713 km.
        expect(distance).toBeGreaterThan(650);
        expect(distance).toBeLessThan(800);
    });
});


describe('isMasterWithinRange', () => {
    const baseUser = {
        country: 'US',
        state: 'New York',
        state_code: 'NY',
        latitude: 40.7128,
        longitude: -74.0060,
    };

    const baseMaster = {
        country: 'US',
        state: 'New York',
        state_code: 'NY',
        latitude: 40.7128,
        longitude: -74.0060,
    };

    it('returns false if user or master country is missing', () => {
        expect(isMasterWithinRange({ ...baseUser, country: null }, baseMaster)).toBe(false);
        expect(isMasterWithinRange(baseUser, { ...baseMaster, country: null })).toBe(false);
    });

    it('returns false if user and master countries are different', () => {
        expect(isMasterWithinRange(baseUser, { ...baseMaster, country: 'CA' })).toBe(false);
    });

    it('returns true if the country matches and the user has no state information', () => {
        const noStateUser = { ...baseUser, state: null, state_code: null };
        expect(isMasterWithinRange(noStateUser, baseMaster)).toBe(true);
    });

    it('returns true if the same country and state_code match', () => {
        expect(isMasterWithinRange(
            { ...baseUser, state: null, state_code: 'CA' },
            { ...baseMaster, state: null, state_code: 'CA' }
        )).toBe(true);
    });

    it('returns true if the same country and state match', () => {
        expect(isMasterWithinRange(
            { ...baseUser, state_code: null, state: 'California' },
            { ...baseMaster, state_code: null, state: 'California' }
        )).toBe(true);
    });

    it('returns true if the same country, different state, but distance is within the radius', () => {
        // Distance between NY and Newark is ~14km.
        // Newark: 40.7357° N, -74.1724° W
        const newarkMaster = {
            ...baseMaster,
            state: 'New Jersey',
            state_code: 'NJ',
            latitude: 40.7357,
            longitude: -74.1724,
        };
        expect(isMasterWithinRange(baseUser, newarkMaster, 100)).toBe(true);
    });

    it('returns false if the same country, different state, and distance is outside the radius', () => {
        // NY to SF is ~4100km
        const sfMaster = {
            ...baseMaster,
            state: 'California',
            state_code: 'CA',
            latitude: 37.7749,
            longitude: -122.4194,
        };
        expect(isMasterWithinRange(baseUser, sfMaster, 100)).toBe(false);
    });

    it('returns false if the same country, different state, but missing latitude/longitude data', () => {
        const njMaster = {
            ...baseMaster,
            state: 'New Jersey',
            state_code: 'NJ',
        };

        // Master missing lat/lng
        expect(isMasterWithinRange(baseUser, { ...njMaster, latitude: null, longitude: null })).toBe(false);

        // User missing lat/lng
        expect(isMasterWithinRange({ ...baseUser, latitude: null, longitude: null }, njMaster)).toBe(false);

        // Both missing lat/lng
        expect(isMasterWithinRange({ ...baseUser, latitude: null, longitude: null }, { ...njMaster, latitude: null, longitude: null })).toBe(false);
    });
});
