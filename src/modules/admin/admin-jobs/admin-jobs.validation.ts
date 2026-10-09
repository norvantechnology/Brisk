import { z } from 'zod';
import { JobStatus } from '@prisma/client';
import { sortByParam, sortOrderParam } from '../../../utils/list-sort';

export const ADMIN_JOB_PAYMENT_STATUSES = ['NOT_INVOICED', 'UNPAID', 'PAID', 'REFUNDED'] as const;
export const ADMIN_JOB_SORT_FIELDS = [
  'createdAt',
  'scheduledDate',
  'status',
  'title',
  'amount',
  'jobRef',
  'categoryName',
  'subcategoryName',
  'customerName',
  'traderName',
  'city',
  'postcode',
  'paymentStatus',
  'offerApplied',
  'quotesCount',
] as const;

const dateParam = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional();

/** `status=SCHEDULED,IN_PROGRESS` or repeated `status=...&status=...`. */
const statusListParam = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    v === undefined
      ? undefined
      : (Array.isArray(v) ? v : v.split(','))
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
  )
  .pipe(z.array(z.nativeEnum(JobStatus)).optional());

const amountParam = z.coerce.number().min(0).optional();

const jobFiltersQuery = z
  .object({
    search: z.string().trim().optional(),
    status: statusListParam,
    customerId: z.string().uuid('Invalid customer ID format.').optional(),
    traderId: z.string().uuid('Invalid trader ID format.').optional(),
    categoryId: z.string().uuid('Invalid category ID format.').optional(),
    paymentStatus: z
      .string()
      .trim()
      .toUpperCase()
      .pipe(z.enum(ADMIN_JOB_PAYMENT_STATUSES))
      .optional(),
    offer: z.string().trim().toUpperCase().pipe(z.enum(['APPLIED', 'NONE'])).optional(),
    minAmount: amountParam,
    maxAmount: amountParam,
    from: dateParam,
    to: dateParam,
    /** Default (omitted/false) hides archived jobs; `true` = archived only; `all` = both. */
    archived: z.string().trim().toLowerCase().pipe(z.enum(['true', 'false', 'all'])).optional(),
  })
  .refine((q) => q.minAmount === undefined || q.maxAmount === undefined || q.minAmount <= q.maxAmount, {
    message: 'minAmount cannot be greater than maxAmount.',
    path: ['minAmount'],
  });

export const adminJobsStatsQuerySchema = z.object({
  query: jobFiltersQuery,
});

export const adminJobsListQuerySchema = z.object({
  query: jobFiltersQuery.and(
    z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      sortBy: sortByParam(ADMIN_JOB_SORT_FIELDS),
      sortOrder: sortOrderParam,
    })
  ),
});

export const adminJobIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid job ID format.'),
  }),
});

export const adminJobChatQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid job ID format.'),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const ADMIN_DISPUTE_STATUSES = ['OPEN', 'IN REVIEW', 'RESOLVED', 'REJECTED'] as const;
export const ADMIN_DISPUTE_SORT_FIELDS = [
  'disputeRef',
  'reason',
  'status',
  'jobRef',
  'jobTitle',
  'customerName',
  'traderName',
  'resolvedAt',
  'createdAt',
  'updatedAt',
] as const;

const disputeStatusParam = z
  .string()
  .trim()
  .toUpperCase()
  .transform((s) => s.replace(/_/g, ' '))
  .pipe(z.enum(ADMIN_DISPUTE_STATUSES));

export const adminDisputesListQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    status: disputeStatusParam.optional(),
    jobId: z.string().uuid('Invalid job ID format.').optional(),
    customerId: z.string().uuid('Invalid customer ID format.').optional(),
    traderId: z.string().uuid('Invalid trader ID format.').optional(),
    reason: z.string().trim().min(1).optional(),
    from: dateParam,
    to: dateParam,
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: sortByParam(ADMIN_DISPUTE_SORT_FIELDS),
    sortOrder: sortOrderParam,
  }),
});

export const adminDisputeIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid dispute ID format.') }),
});

export const adminUpdateDisputeSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid dispute ID format.') }),
  body: z
    .object({
      status: disputeStatusParam.optional(),
      adminNote: z.string().trim().max(5000).nullable().optional(),
    })
    .refine((b) => b.status !== undefined || b.adminNote !== undefined, {
      message: 'Provide status and/or adminNote.',
    }),
});

export const adminCancelJobSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid job ID format.') }),
  body: z.object({
    reason: z.string().trim().min(1, 'reason is required.').max(1000),
  }),
});

export const adminRescheduleJobSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid job ID format.') }),
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD.'),
    timeSlot: z.string().trim().min(1, 'timeSlot is required.').max(50),
  }),
});

export const adminArchiveJobSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid job ID format.') }),
  body: z.object({ archived: z.boolean() }),
});

export type AdminRescheduleJobInput = z.infer<typeof adminRescheduleJobSchema>['body'];
export type AdminDisputesListQuery = z.infer<typeof adminDisputesListQuerySchema>['query'];
export type AdminUpdateDisputeInput = z.infer<typeof adminUpdateDisputeSchema>['body'];
export type AdminJobFilters = z.infer<typeof jobFiltersQuery>;
export type AdminJobsListQuery = z.infer<typeof adminJobsListQuerySchema>['query'];
