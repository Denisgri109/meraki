/**
 * Haversine distance in kilometres between two lat/lng pairs.
 */
export function haversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns true if the master is within the user's allowed search area:
 *
 * 1. Same country (case-insensitive) — required.
 * 2. Same state / region → always visible.
 * 3. Different state, same country → visible if both have lat/lng and
 *    the haversine distance is within radiusKm (defaults to 100 km).
 */
export function isMasterWithinRange(
    user: {
        country: string | null;
        state?: string | null;
        state_code?: string | null;
        latitude?: number | null;
        longitude?: number | null;
    },
    master: {
        country: string | null;
        state?: string | null;
        state_code?: string | null;
        latitude?: number | null;
        longitude?: number | null;
    },
    radiusKm: number = 100
): boolean {
    // Must share the same country
    if (!user.country) return false;
    const userCountry = user.country.toLowerCase().trim();
    if (!master.country) return false;
    if (master.country.toLowerCase().trim() !== userCountry) return false;

    // State match check
    const userStateCode = user.state_code?.toLowerCase().trim() || '';
    const userStateName = user.state?.toLowerCase().trim() || '';
    const masterStateCode = master.state_code?.toLowerCase().trim() || '';
    const masterStateName = master.state?.toLowerCase().trim() || '';

    // If user has no state set → country match is enough
    if (!userStateCode && !userStateName) return true;

    // Check if states match
    let sameState = false;
    if (userStateCode && masterStateCode) {
        sameState = userStateCode === masterStateCode;
    } else if (userStateName && masterStateName) {
        sameState = userStateName === masterStateName;
    }
    if (sameState) return true;

    // Different state → fall back to haversine distance
    const uLat = user.latitude;
    const uLng = user.longitude;
    const mLat = master.latitude;
    const mLng = master.longitude;
    if (
        uLat != null && uLng != null &&
        mLat != null && mLng != null
    ) {
        const dist = haversineDistanceKm(uLat, uLng, mLat, mLng);
        return dist <= radiusKm;
    }

    // No lat/lng on one or both sides — can't calculate distance, reject
    return false;
}
