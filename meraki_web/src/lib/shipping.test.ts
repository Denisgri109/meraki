import { EUROPEAN_COUNTRIES_SORTED, getShippingCost, getCountryName } from './shipping';

describe('EUROPEAN_COUNTRIES_SORTED', () => {
  it('should be sorted by country name alphabetically', () => {
    const names = EUROPEAN_COUNTRIES_SORTED.map(country => country.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });

  it('should contain some known countries', () => {
    expect(EUROPEAN_COUNTRIES_SORTED).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FR', name: 'France' }),
        expect.objectContaining({ code: 'DE', name: 'Germany' })
      ])
    );
  });
});

describe('getShippingCost', () => {
  it('should return the correct shipping cost for a valid country code', () => {
    expect(getShippingCost('GB')).toBe(4.99);
    expect(getShippingCost('DE')).toBe(6.49);
    expect(getShippingCost('FR')).toBe(6.99);
  });

  it('should return 0 for an invalid country code', () => {
    expect(getShippingCost('US')).toBe(0);
    expect(getShippingCost('CA')).toBe(0);
    expect(getShippingCost('XYZ')).toBe(0);
    expect(getShippingCost('XX')).toBe(0);
  });

  it('should return 0 for an empty string', () => {
    expect(getShippingCost('')).toBe(0);
  });

  it('should return 0 for undefined/null if bypassed', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getShippingCost(undefined as any)).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getShippingCost(null as any)).toBe(0);
  });
});

describe('getCountryName', () => {
  it('returns the correct country name for a valid European country code', () => {
    expect(getCountryName('FR')).toBe('France');
    expect(getCountryName('GB')).toBe('United Kingdom');
    expect(getCountryName('DE')).toBe('Germany');
  });

  it('returns the country code if it is not found in the list', () => {
    expect(getCountryName('US')).toBe('US');
    expect(getCountryName('XYZ')).toBe('XYZ');
    expect(getCountryName('INVALID')).toBe('INVALID');
    expect(getCountryName('XX')).toBe('XX');
  });

  it('returns the original input if given an empty string', () => {
    expect(getCountryName('')).toBe('');
  });

  it('is case-sensitive and returns the input code if it is lowercase', () => {
    expect(getCountryName('fr')).toBe('fr');
    expect(getCountryName('gb')).toBe('gb');
  });
});
