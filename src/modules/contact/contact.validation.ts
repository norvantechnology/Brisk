import { z } from 'zod';
import { SurveyRegistrationStatus } from '@prisma/client';

const paginationQuery = {
  page: z.string().optional(),
  limit: z.string().optional(),
};

export const createContactSubmissionSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(1, 'Full name is required'),
    email: z.string().trim().email('Invalid email format'),
    phone: z.string().trim().min(1, 'Contact number is required'),
    subject: z.string().trim().min(1, 'Subject is required'),
    message: z.string().trim().min(10, 'Message must be at least 10 characters'),
    agreementAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Privacy Policy and Terms.' }),
    }),
  }),
});

export const contactFilterSchema = z.object({
  query: z.object({
    ...paginationQuery,
    search: z.string().optional(),
    status: z.nativeEnum(SurveyRegistrationStatus).optional(),
    sort: z.enum(['newest', 'oldest']).optional(),
    sortBy: z.enum(['name', 'status', 'submittedAt', 'subject']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    submittedFrom: z.string().optional(),
    submittedTo: z.string().optional(),
    dateFilter: z.string().optional(),
  }),
});

export const updateContactSubmissionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.nativeEnum(SurveyRegistrationStatus).optional(),
    notes: z.string().optional(),
  }),
});

export const contactIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type CreateContactSubmissionInput = z.infer<typeof createContactSubmissionSchema>['body'];
export type ContactSubmissionFilters = z.infer<typeof contactFilterSchema>['query'];
export type UpdateContactSubmissionInput = z.infer<typeof updateContactSubmissionSchema>['body'];
