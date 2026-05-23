export interface EuropeanCountry {
  code: string;
  name: string;
  shippingCost: number;
}

export const EUROPEAN_COUNTRIES: EuropeanCountry[] = [
  { code: 'GB', name: 'United Kingdom', shippingCost: 4.99 },
  { code: 'IE', name: 'Ireland', shippingCost: 5.99 },
  { code: 'NL', name: 'Netherlands', shippingCost: 5.99 },
  { code: 'BE', name: 'Belgium', shippingCost: 5.99 },
  { code: 'LU', name: 'Luxembourg', shippingCost: 5.99 },
  { code: 'DE', name: 'Germany', shippingCost: 6.49 },
  { code: 'FR', name: 'France', shippingCost: 6.99 },
  { code: 'AT', name: 'Austria', shippingCost: 6.99 },
  { code: 'MC', name: 'Monaco', shippingCost: 7.49 },
  { code: 'LI', name: 'Liechtenstein', shippingCost: 7.49 },
  { code: 'AD', name: 'Andorra', shippingCost: 7.99 },
  { code: 'SM', name: 'San Marino', shippingCost: 7.99 },
  { code: 'VA', name: 'Vatican City', shippingCost: 7.99 },
  { code: 'ES', name: 'Spain', shippingCost: 7.49 },
  { code: 'PT', name: 'Portugal', shippingCost: 7.99 },
  { code: 'IT', name: 'Italy', shippingCost: 7.49 },
  { code: 'GR', name: 'Greece', shippingCost: 8.99 },
  { code: 'MT', name: 'Malta', shippingCost: 9.99 },
  { code: 'CY', name: 'Cyprus', shippingCost: 9.99 },
  { code: 'DK', name: 'Denmark', shippingCost: 7.49 },
  { code: 'SE', name: 'Sweden', shippingCost: 8.49 },
  { code: 'NO', name: 'Norway', shippingCost: 9.99 },
  { code: 'FI', name: 'Finland', shippingCost: 11.99 },
  { code: 'IS', name: 'Iceland', shippingCost: 14.99 },
  { code: 'PL', name: 'Poland', shippingCost: 5.99 },
  { code: 'CZ', name: 'Czech Republic', shippingCost: 5.99 },
  { code: 'SK', name: 'Slovakia', shippingCost: 5.99 },
  { code: 'HU', name: 'Hungary', shippingCost: 6.49 },
  { code: 'SI', name: 'Slovenia', shippingCost: 6.49 },
  { code: 'HR', name: 'Croatia', shippingCost: 6.99 },
  { code: 'EE', name: 'Estonia', shippingCost: 6.99 },
  { code: 'LV', name: 'Latvia', shippingCost: 6.99 },
  { code: 'LT', name: 'Lithuania', shippingCost: 6.49 },
  { code: 'RO', name: 'Romania', shippingCost: 6.99 },
  { code: 'BG', name: 'Bulgaria', shippingCost: 7.49 },
  { code: 'CH', name: 'Switzerland', shippingCost: 11.99 },
  { code: 'AL', name: 'Albania', shippingCost: 12.99 },
  { code: 'BA', name: 'Bosnia and Herzegovina', shippingCost: 12.99 },
  { code: 'RS', name: 'Serbia', shippingCost: 11.99 },
  { code: 'ME', name: 'Montenegro', shippingCost: 12.99 },
  { code: 'MK', name: 'North Macedonia', shippingCost: 12.99 },
  { code: 'MD', name: 'Moldova', shippingCost: 13.99 },
  { code: 'UA', name: 'Ukraine', shippingCost: 14.99 },
];

export const EUROPEAN_COUNTRIES_SORTED = [...EUROPEAN_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

export function getShippingCost(countryCode: string): number {
  return EUROPEAN_COUNTRIES.find((country) => country.code === countryCode)?.shippingCost ?? 0;
}

export function getCountryName(countryCode: string): string {
  return EUROPEAN_COUNTRIES.find((country) => country.code === countryCode)?.name ?? countryCode;
}
