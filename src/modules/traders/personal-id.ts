import { BadRequestError } from '../../utils/errors';

/** Sole-trader personal tax ID: Irish PPS Number or UK National Insurance (NI) Number. */
export type PersonalIdType = 'PPS' | 'NI';

const PPS_PATTERN = /^\d{7}[A-W][A-IW]?$/;
const NI_PATTERN = /^(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/;
const UK_COUNTRY_PATTERN =
  /^(uk|gb|u\.k\.|united kingdom|great britain|england|scotland|wales|northern ireland)$/i;

export const normalizePersonalId = (value: string): string =>
  value.replace(/[\s-]/g, '').toUpperCase();

export const personalIdTypeForCountry = (country?: string | null): PersonalIdType =>
  UK_COUNTRY_PATTERN.test(country?.trim() ?? '') ? 'NI' : 'PPS';

export const personalIdLabel = (type: PersonalIdType): string =>
  type === 'NI' ? 'NI Number' : 'PPS Number';

/** `{ personalIdType, personalIdLabel }` for profile responses — FE shows the label as the field title. */
export const describePersonalId = (country?: string | null) => {
  const type = personalIdTypeForCountry(country);
  return { personalIdType: type, personalIdLabel: personalIdLabel(type) };
};

/**
 * Accepts a valid PPS or NI Number (country may be missing or stale) and returns the normalized value.
 * Country only picks the error wording (IE → PPS, UK → NI).
 */
export const validatePersonalId = (raw: string, country?: string | null): string => {
  const value = normalizePersonalId(raw);
  const type = personalIdTypeForCountry(country);
  if (!PPS_PATTERN.test(value) && !NI_PATTERN.test(value)) {
    throw new BadRequestError(
      type === 'NI'
        ? 'Enter a valid NI Number, e.g. QQ123456C.'
        : 'Enter a valid PPS Number, e.g. 1234567FA.',
      { code: 'INVALID_PERSONAL_ID', data: { field: type === 'NI' ? 'niNumber' : 'ppsNumber' } }
    );
  }
  return value;
};
