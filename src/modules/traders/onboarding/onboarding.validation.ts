import { z } from 'zod';

const urlSchema = z.string().trim().url('Must be a valid URL');

export const businessTypeSchema = z.object({
  body: z.object({
    entityType: z.enum(['SOLO', 'COMPANY']),
  }),
});

export const uploadDocumentSchema = z.object({
  body: z.object({
    documentRuleId: z.string().uuid(),
    fileUrl: urlSchema,
    fileName: z.string().trim().min(1).max(255).optional(),
  }),
});

export const documentRuleIdParamSchema = z.object({
  params: z.object({
    documentRuleId: z.string().uuid(),
  }),
});

export const categoriesSchema = z.object({
  body: z.object({
    categoryIds: z.array(z.string().uuid()).min(1, 'Select at least one trade category'),
  }),
});

const addressFields = {
  addressLine1: z.string().trim().min(1).max(255),
  addressLine2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(100),
  postcode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100).optional(),
};

export const soloProfileSchema = z.object({
  body: z.object({
    fullLegalName: z.string().trim().min(2).max(255),
    ppsNumber: z.string().trim().min(1).max(20),
    bio: z.string().trim().max(300).optional(),
    yearsExperience: z.number().int().min(0).max(80).optional(),
    ...addressFields,
  }),
});

export const companyProfileSchema = z.object({
  body: z.object({
    companyName: z.string().trim().min(2).max(255),
    croNumber: z.string().trim().regex(/^\d{8}$/, 'CRO must be an 8-digit number'),
    vatNumber: z.string().trim().min(1).max(20).optional(),
    directorFullName: z.string().trim().min(2).max(255),
    bio: z.string().trim().max(300).optional(),
    yearsExperience: z.number().int().min(0).max(80).optional(),
    ...addressFields,
  }),
});

export const bankDetailsSchema = z.object({
  body: z
    .object({
      skip: z.literal(true).optional(),
      bankHolderName: z.string().trim().min(2).max(255).optional(),
      bankName: z.string().trim().min(2).max(255).optional(),
      accountNumber: z.string().trim().min(4).max(34).optional(),
      ifscCode: z.string().trim().min(4).max(20).optional(),
    })
    .superRefine((body, ctx) => {
      if (body.skip) {
        return;
      }
      const required = ['bankHolderName', 'bankName', 'accountNumber', 'ifscCode'] as const;
      for (const field of required) {
        if (!body[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field} is required unless skip is true`,
            path: [field],
          });
        }
      }
    }),
});

export const serviceRadiusSchema = z.object({
  body: z.object({
    serviceRadiusKm: z.number().int().min(1).max(500),
    serviceCenterLat: z.number().min(-90).max(90),
    serviceCenterLng: z.number().min(-180).max(180),
    serviceCenterLabel: z.string().trim().min(1).max(255),
  }),
});

export type BusinessTypeInput = z.infer<typeof businessTypeSchema>['body'];
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>['body'];
export type CategoriesInput = z.infer<typeof categoriesSchema>['body'];
export type SoloProfileInput = z.infer<typeof soloProfileSchema>['body'];
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>['body'];
export type BankDetailsInput = z.infer<typeof bankDetailsSchema>['body'];
export type ServiceRadiusInput = z.infer<typeof serviceRadiusSchema>['body'];
