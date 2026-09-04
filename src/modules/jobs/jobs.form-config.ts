import { DiscountType, JobQuoteType, SubcategoryPriceEnteredBy } from '@prisma/client';

type SubcategoryFlags = {
  id?: string;
  name?: string;
  siteVisitEnabled: boolean;
  siteVisitFee?: number | { toString(): string } | null;
  priceEnabled: boolean;
  priceEnteredBy: SubcategoryPriceEnteredBy | 'CUSTOMER' | 'TRADER';
  qaFormSchema?: unknown;
} | null | undefined;

export type JobFormEntryPoint =
  | 'OFFER'
  | 'HOME_CATEGORY'
  | 'HOME_SUBCATEGORY'
  | 'DIRECT'
  | 'TRADER_PROFILE';

/** Prefer empty string over null for mobile model completeness. */
export const str = (value: string | null | undefined): string =>
  value == null ? '' : String(value);

/**
 * Site visit fee is **only** from subcategory.siteVisitFee (admin/DB).
 * No platform default amount — if unset while site visit is enabled, amount is 0.
 */
export const resolveSiteVisitFee = (subcategory?: SubcategoryFlags): number => {
  if (!subcategory?.siteVisitEnabled) return 0;
  if (subcategory.siteVisitFee != null && Number(subcategory.siteVisitFee) >= 0) {
    return Number(subcategory.siteVisitFee);
  }
  return 0;
};

const currencySymbol = (currencyCode: string) =>
  ({ EUR: '€', GBP: '£', USD: '$', INR: '₹' } as Record<string, string>)[currencyCode] ?? currencyCode;

const formatFee = (amount: number, currencyCode: string) => {
  if (!currencyCode || amount <= 0) return '';
  return `${currencySymbol(currencyCode)}${amount.toFixed(2)}`;
};

/**
 * Dynamic offer chip data only — no Figma marketing sentences.
 * Mobile builds banner copy from discountLabel / discountValue / discountType.
 */
export const buildOfferAppliedBanner = (input: {
  discountType?: DiscountType | string | null;
  discountValue?: number | null;
  discountLabel?: string | null;
  currencyCode?: string;
}) => {
  const currencyCode = str(input.currencyCode);
  const symbol = currencyCode ? currencySymbol(currencyCode) : '';
  const value = input.discountValue != null ? Number(input.discountValue) : null;
  let shortLabel = input.discountLabel?.trim() || '';

  if (!shortLabel && value != null) {
    if (input.discountType === DiscountType.PERCENTAGE || input.discountType === 'PERCENTAGE') {
      shortLabel = `${value}%`;
    } else if (input.discountType === DiscountType.FREE_SERVICE || input.discountType === 'FREE_SERVICE') {
      shortLabel = '';
    } else if (symbol) {
      shortLabel = `${symbol}${Number.isInteger(value) ? value : value.toFixed(2)}`;
    } else {
      shortLabel = String(value);
    }
  }

  return {
    title: '',
    message: '',
    discountLabel: shortLabel,
  };
};

const emptyOfferBanner = () => ({
  title: '',
  message: '',
  discountLabel: '',
});

/**
 * Unified Post a New Job show/hide — same shape for every entry point.
 * Returns **flags + DB amounts + navigation keys** only.
 * UI labels / CTAs / marketing copy live on the mobile client (Figma is visual reference only).
 */
export const buildJobFormConfig = (input: {
  offerApplied: boolean;
  subcategory?: SubcategoryFlags;
  entryPoint?: JobFormEntryPoint;
  currencyCode?: string;
  offerBanner?: ReturnType<typeof buildOfferAppliedBanner> | null;
}) => {
  const sub = input.subcategory ?? null;
  const qaFormSchema = Array.isArray(sub?.qaFormSchema) ? sub!.qaFormSchema : [];
  const priceEnabled = sub?.priceEnabled ?? true;
  const priceEnteredBy = (sub?.priceEnteredBy ?? SubcategoryPriceEnteredBy.CUSTOMER) as
    | SubcategoryPriceEnteredBy
    | 'CUSTOMER'
    | 'TRADER';
  const customerEntersPrice =
    priceEnabled && priceEnteredBy === SubcategoryPriceEnteredBy.CUSTOMER;
  const siteVisitEnabled = Boolean(sub?.siteVisitEnabled);
  const offerApplied = input.offerApplied;
  const entryPoint: JobFormEntryPoint =
    input.entryPoint ?? (offerApplied ? 'OFFER' : 'DIRECT');
  const currencyCode = str(input.currencyCode);
  const siteVisitFeeAmount = siteVisitEnabled ? resolveSiteVisitFee(sub) : 0;
  const siteVisitFeeFormatted = formatFee(siteVisitFeeAmount, currencyCode);

  const showBudgetForRemote = customerEntersPrice;

  const quoteTypeOptions = [
    {
      key: JobQuoteType.REMOTE,
      label: '',
      description: '',
      icon: 'remote' as const,
      available: true,
      feeAmount: 0,
      feeFormatted: '',
      feeCurrency: currencyCode,
      showMinBudget: showBudgetForRemote,
      showMaxBudget: showBudgetForRemote,
      showSiteVisitFee: false,
    },
    {
      key: JobQuoteType.ONSITE,
      label: '',
      description: '',
      icon: 'onsite' as const,
      available: siteVisitEnabled,
      feeAmount: siteVisitFeeAmount,
      feeFormatted: siteVisitFeeFormatted,
      feeCurrency: currencyCode,
      showMinBudget: false,
      showMaxBudget: false,
      showSiteVisitFee: siteVisitEnabled && siteVisitFeeAmount > 0,
    },
  ];

  const nextAfterLocation =
    offerApplied || siteVisitEnabled ? 'SITE_VISIT_PAY_FEE' : 'WAITING_FOR_QUOTES';

  const offerBanner =
    offerApplied && input.offerBanner
      ? {
          title: '',
          message: '',
          discountLabel: str(input.offerBanner.discountLabel),
        }
      : emptyOfferBanner();

  return {
    entryPoint,
    offerApplied,
    showOfferBanner: offerApplied,
    offerBanner,
    showQuoteType: true,
    quoteTypeOptions,
    defaultQuoteType: JobQuoteType.REMOTE,
    quoteTypeLocked: '',
    showBudgetRange: showBudgetForRemote,
    showMinBudget: showBudgetForRemote,
    showMaxBudget: showBudgetForRemote,
    budgetRequired: false,
    budgetCurrencyCode: currencyCode,
    budgetCurrencySymbol: currencyCode ? currencySymbol(currencyCode) : '',
    budgetVisibleForQuoteTypes: showBudgetForRemote ? [JobQuoteType.REMOTE] : ([] as JobQuoteType[]),
    visibilityByQuoteType: {
      REMOTE: {
        showMinBudget: showBudgetForRemote,
        showMaxBudget: showBudgetForRemote,
        showBudgetRange: showBudgetForRemote,
        showSiteVisitFee: false,
        nextAfterLocation: offerApplied ? 'SITE_VISIT_PAY_FEE' : 'WAITING_FOR_QUOTES',
      },
      ONSITE: {
        showMinBudget: false,
        showMaxBudget: false,
        showBudgetRange: false,
        showSiteVisitFee: siteVisitEnabled && siteVisitFeeAmount > 0,
        nextAfterLocation: 'SITE_VISIT_PAY_FEE',
      },
    },
    showSiteVisitFee: siteVisitEnabled && siteVisitFeeAmount > 0,
    siteVisitFee: {
      amount: siteVisitFeeAmount,
      currencyCode,
      formatted: siteVisitFeeFormatted,
      label: '',
      note: '',
      enabled: siteVisitEnabled,
    },
    showServiceCharge: false,
    serviceChargeRequired: false,
    showSiteVisit: siteVisitEnabled,
    siteVisitEnabled,
    showQaForm: qaFormSchema.length > 0,
    qaFormSchema,
    showImageUpload: true,
    imageUploadPurpose: 'job_photo',
    maxImages: 10,
    /** Empty — time/duration option lists are owned by the mobile app. */
    timeSlotOptions: [] as Array<{ key: string; label: string; range: string }>,
    durationOptions: [] as Array<{ key: string; label: string }>,
    priceEnabled,
    priceEnteredBy,
    /** Navigation keys only — labels/CTAs are owned by the mobile app. */
    flowSteps:
      siteVisitEnabled || offerApplied
        ? [
            { key: 'POST_NEW_JOB', label: '', cta: '' },
            { key: 'CHOOSE_LOCATION', label: '', cta: '' },
            { key: 'SITE_VISIT_PAY_FEE', label: '', cta: '' },
            { key: 'SUCCESS', label: '', cta: '' },
          ]
        : [
            { key: 'POST_NEW_JOB', label: '', cta: '' },
            { key: 'CHOOSE_LOCATION', label: '', cta: '' },
            { key: 'WAITING_FOR_QUOTES', label: '', cta: '' },
          ],
    nextAfterJobForm: 'CHOOSE_LOCATION',
    nextAfterLocation,
    publishCtaLabel: '',
    chooseLocationCtaLabel: '',
    addressesPath: 'GET /addresses',
    createAddressPath: 'POST /addresses',
    payScreen: {
      title: '',
      confirmPayLabelTemplate: '',
      successTitle: '',
      successMessage: '',
      viewJobPathTemplate: '/jobs/{jobId}',
    },
    rulesNote: '',
  };
};

export type JobFormConfig = ReturnType<typeof buildJobFormConfig>;

/** Complete nextJobPrefill — every key always present for mobile models. */
export const buildNextJobPrefill = (input: {
  claimId?: string | null;
  offerId: string;
  traderId?: string | null;
  categoryId?: string | null;
  categoryIds?: string[];
  subcategoryId?: string | null;
  subcategoryIds?: string[];
  ctaAction?: string | null;
  offerApplied?: boolean;
  bannerTitle?: string | null;
  bannerSubtitle?: string | null;
  bannerMessage?: string | null;
  discountLabel?: string | null;
  bannerImageUrl?: string | null;
  title?: string | null;
  quoteType?: JobQuoteType | string | null;
  formConfig: JobFormConfig;
}) => {
  const fc = input.formConfig;
  const siteVisit = fc.siteVisitFee;
  return {
    claimId: str(input.claimId),
    appliedTraderOfferId: str(input.offerId),
    offerId: str(input.offerId),
    traderId: str(input.traderId),
    categoryId: str(input.categoryId),
    categoryIds: input.categoryIds ?? [],
    subcategoryId: str(input.subcategoryId),
    subcategoryIds: input.subcategoryIds ?? [],
    ctaAction: str(input.ctaAction),
    offerApplied: Boolean(input.offerApplied ?? true),
    bannerTitle: str(input.bannerTitle),
    bannerSubtitle: str(input.bannerSubtitle),
    bannerMessage: '',
    discountLabel: str(input.discountLabel),
    bannerImageUrl: str(input.bannerImageUrl),
    title: str(input.title),
    quoteType: (input.quoteType as string) || fc.defaultQuoteType,
    showQuoteType: fc.showQuoteType,
    showMinBudget: fc.showMinBudget,
    showMaxBudget: fc.showMaxBudget,
    showBudgetRange: fc.showBudgetRange,
    showSiteVisitFee: fc.showSiteVisitFee,
    siteVisitEnabled: fc.siteVisitEnabled,
    siteVisitFeeAmount: siteVisit.amount,
    siteVisitFeeFormatted: siteVisit.formatted,
    siteVisitFeeCurrency: siteVisit.currencyCode,
    siteVisitFee: siteVisit,
    visibilityByQuoteType: fc.visibilityByQuoteType,
    minBudget: 0,
    maxBudget: 0,
    timeSlot: '',
    durationLabel: '',
    phoneNumber: '',
    description: '',
    photoUrls: [] as string[],
  };
};

export const resolveQuoteTypeForCreate = (input: {
  quoteType?: JobQuoteType | null;
  formDefault: JobQuoteType;
}): JobQuoteType => input.quoteType ?? input.formDefault;
