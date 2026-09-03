import { JobQuoteType, SubcategoryPriceEnteredBy } from '@prisma/client';

type SubcategoryFlags = {
  siteVisitEnabled: boolean;
  priceEnabled: boolean;
  priceEnteredBy: SubcategoryPriceEnteredBy | 'CUSTOMER' | 'TRADER';
  qaFormSchema?: unknown;
} | null | undefined;

/**
 * UI show/hide rules for Post a New Job.
 * Mobile should drive quote type + min/max budget visibility from this object
 * (and from the selected quoteType when showQuoteType is true).
 */
export const buildJobFormConfig = (input: {
  offerApplied: boolean;
  subcategory?: SubcategoryFlags;
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

  const base = {
    showImageUpload: true,
    imageUploadPurpose: 'job_photo' as const,
    maxImages: 10,
    showSiteVisit: Boolean(sub?.siteVisitEnabled),
    showQaForm: qaFormSchema.length > 0,
    qaFormSchema,
    priceEnabled,
    priceEnteredBy,
    nextAfterJobForm: 'CHOOSE_LOCATION' as const,
  };

  // Direct Trader / Accept Offer path — lock FIXED, hide quote type & budget
  if (input.offerApplied) {
    return {
      ...base,
      offerApplied: true,
      showOfferBanner: true,
      showQuoteType: false,
      quoteTypeOptions: [] as Array<{ key: JobQuoteType; label: string }>,
      defaultQuoteType: JobQuoteType.FIXED,
      quoteTypeLocked: JobQuoteType.FIXED,
      showServiceCharge: true,
      serviceChargeRequired: true,
      showBudgetRange: false,
      showMinBudget: false,
      showMaxBudget: false,
      /** After location select → Payment Details (invoice on publish) */
      nextAfterLocation: 'PAYMENT_DETAILS' as const,
    };
  }

  // Quote-wise / no offer — quote type + budget show/hide by subcategory flags
  const quoteTypeOptions: Array<{ key: JobQuoteType; label: string }> = [
    ...(customerEntersPrice
      ? [
          { key: JobQuoteType.FIXED, label: 'Fixed Price' },
          { key: JobQuoteType.BUDGET_RANGE, label: 'Min / Max Budget' },
        ]
      : []),
    { key: JobQuoteType.OPEN_QUOTE, label: 'Request Quotes' },
  ];

  const defaultQuoteType = customerEntersPrice
    ? JobQuoteType.BUDGET_RANGE
    : JobQuoteType.OPEN_QUOTE;

  return {
    ...base,
    offerApplied: false,
    showOfferBanner: false,
    showQuoteType: quoteTypeOptions.length > 1,
    quoteTypeOptions,
    defaultQuoteType,
    quoteTypeLocked: null as JobQuoteType | null,
    /** Client: show when selected quoteType === FIXED */
    showServiceCharge: customerEntersPrice,
    serviceChargeRequired: false,
    serviceChargeVisibleWhen: JobQuoteType.FIXED,
    /** Client: show when selected quoteType === BUDGET_RANGE */
    showBudgetRange: customerEntersPrice,
    showMinBudget: customerEntersPrice,
    showMaxBudget: customerEntersPrice,
    budgetVisibleWhen: JobQuoteType.BUDGET_RANGE,
    /** After location → waiting for trader quotes (not payment yet) */
    nextAfterLocation: 'WAITING_FOR_QUOTES' as const,
  };
};

export const resolveQuoteTypeForCreate = (input: {
  offerApplied: boolean;
  quoteType?: JobQuoteType | null;
  formDefault: JobQuoteType;
}): JobQuoteType => {
  if (input.offerApplied) return JobQuoteType.FIXED;
  return input.quoteType ?? input.formDefault;
};
