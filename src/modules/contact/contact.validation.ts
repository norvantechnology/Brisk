import { z } from 'zod';
import { SurveyRegistrationStatus } from '@prisma/client';
import { requireNoteWhenRejected } from '../../utils/reject-note';
import { sortByParam, sortOrderParam } from '../../utils/list-sort';

export const ADMIN_CONTACT_SORT_FIELDS = [
  'referenceCode',
  'name',
  'email',
  'phone',
  'subject',
  'status',
  'reviewedBy',
  'submittedAt',
  'updatedAt',
] as const;

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
    sortBy: sortByParam(ADMIN_CONTACT_SORT_FIELDS),
    sortOrder: sortOrderParam,
    submittedFrom: z.string().optional(),
    submittedTo: z.string().optional(),
    dateFilter: z.string().optional(),
  }),
});

export const updateContactSubmissionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      status: z.nativeEnum(SurveyRegistrationStatus).optional(),
      notes: z.string().optional(),
    })
    .superRefine(requireNoteWhenRejected('notes')),
});

export const contactIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type CreateContactSubmissionInput = z.infer<typeof createContactSubmissionSchema>['body'];
export type ContactSubmissionFilters = z.infer<typeof contactFilterSchema>['query'];
export type UpdateContactSubmissionInput = z.infer<typeof updateContactSubmissionSchema>['body'];
