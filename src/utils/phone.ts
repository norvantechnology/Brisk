/** Common E.164 prefixes — longest match first (Ireland +353 first for BRISK). */
const KNOWN_COUNTRY_CODES = [
  '+353',
  '+351',
  '+358',
  '+420',
  '+971',
  '+966',
  '+972',
  '+234',
  '+254',
  '+880',
  '+44',
  '+91',
  '+61',
  '+49',
  '+33',
  '+34',
  '+39',
  '+31',
  '+32',
  '+48',
  '+46',
  '+47',
  '+45',
  '+41',
  '+43',
  '+36',
  '+30',
  '+86',
  '+81',
  '+82',
  '+65',
  '+60',
  '+66',
  '+84',
  '+62',
  '+63',
  '+64',
  '+27',
  '+90',
  '+52',
  '+55',
  '+54',
  '+57',
  '+56',
  '+51',
  '+7',
  '+1',
].sort((a, b) => b.length - a.length);

export type SplitMobile = {
  mobileCountryCode: string | null;
  /** National number without country code (digits only). */
  mobileNumber: string | null;
};

/** Split stored E.164 (+353871234567) into country code and local number for app UI. */
export const splitE164Mobile = (e164: string | null | undefined): SplitMobile => {
  if (!e164) {
    return { mobileCountryCode: null, mobileNumber: null };
  }

  const trimmed = e164.trim();
  if (!trimmed.startsWith('+')) {
    return { mobileCountryCode: null, mobileNumber: trimmed };
  }

  for (const code of KNOWN_COUNTRY_CODES) {
    if (trimmed.startsWith(code) && trimmed.length > code.length) {
      return {
        mobileCountryCode: code,
        mobileNumber: trimmed.slice(code.length),
      };
    }
  }

  // Fallback: 1–3 digit ITU country code after +
  for (const len of [3, 2, 1]) {
    const code = trimmed.slice(0, 1 + len);
    const rest = trimmed.slice(1 + len);
    if (/^\+\d+$/.test(code) && rest.length >= 4) {
      return { mobileCountryCode: code, mobileNumber: rest };
    }
  }

  return { mobileCountryCode: null, mobileNumber: trimmed.replace(/^\+/, '') };
};

/** Attach split mobile fields to profile payload (response only). */
export const withSplitMobileFields = <T extends { mobileNumber?: string | null }>(
  profile: T
): Omit<T, 'mobileNumber'> & SplitMobile => {
  const { mobileNumber: storedMobile, ...rest } = profile;
  const split = splitE164Mobile(storedMobile ?? null);
  return {
    ...rest,
    mobileCountryCode: split.mobileCountryCode,
    mobileNumber: split.mobileNumber,
  };
};
