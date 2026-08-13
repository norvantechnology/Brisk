import { ActorType, ContactSubmission, Prisma, SurveyRegistrationStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { sendContactEmails } from '../../services/email.service';
import type {
  ContactSubmissionFilters,
  CreateContactSubmissionInput,
  UpdateContactSubmissionInput,
} from './contact.validation';

const reviewedBySelect = {
  id: true,
  fullName: true,
  email: true,
} as const;

const parsePageLimit = (filters: ContactSubmissionFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const startOfTodayUtc = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const resolveDateFilterRange = (
  dateFilter?: string
): { gte?: Date; lte?: Date } | undefined => {
  if (!dateFilter) return undefined;
  const key = dateFilter.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!key || key === 'all') return undefined;

  const todayStart = startOfTodayUtc();
  const now = new Date();

  if (key === 'today') return { gte: todayStart };
  if (key === 'thisweek') {
    const day = todayStart.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(todayStart.getUTCDate() - diffToMonday);
    return { gte: weekStart };
  }
  if (key === 'thismonth') {
    return { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) };
  }
  return undefined;
};

const applySubmittedAtFilters = (
  where: Prisma.ContactSubmissionWhereInput,
  filters: Pick<ContactSubmissionFilters, 'submittedFrom' | 'submittedTo' | 'dateFilter'>
) => {
  const submittedAt: Prisma.DateTimeFilter = {};
  const preset = resolveDateFilterRange(filters.dateFilter);
  if (preset?.gte) submittedAt.gte = preset.gte;
  if (preset?.lte) submittedAt.lte = preset.lte;

  if (filters.submittedFrom) {
    const from = new Date(filters.submittedFrom);
    if (!Number.isNaN(from.getTime())) {
      submittedAt.gte =
        submittedAt.gte instanceof Date && submittedAt.gte > from ? submittedAt.gte : from;
    }
  }
  if (filters.submittedTo) {
    const to = new Date(filters.submittedTo);
    if (!Number.isNaN(to.getTime())) {
      submittedAt.lte =
        submittedAt.lte instanceof Date && submittedAt.lte < to ? submittedAt.lte : to;
    }
  }

  if (Object.keys(submittedAt).length > 0) {
    where.submittedAt = submittedAt;
  }
};

const buildWhere = (filters: ContactSubmissionFilters): Prisma.ContactSubmissionWhereInput => {
  const where: Prisma.ContactSubmissionWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { referenceCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (
    filters.status &&
    Object.values(SurveyRegistrationStatus).includes(filters.status as SurveyRegistrationStatus)
  ) {
    where.status = filters.status as SurveyRegistrationStatus;
  }

  applySubmittedAtFilters(where, filters);
  return where;
};

const buildOrderBy = (
  filters: ContactSubmissionFilters
): Prisma.ContactSubmissionOrderByWithRelationInput => {
  const order: Prisma.SortOrder =
    filters.sortOrder === 'asc' || filters.sortOrder === 'desc'
      ? filters.sortOrder
      : filters.sortBy === 'submittedAt'
        ? 'desc'
        : filters.sortBy
          ? 'asc'
          : 'desc';

  if (filters.sortBy === 'name') return { fullName: order };
  if (filters.sortBy === 'status') return { status: order };
  if (filters.sortBy === 'subject') return { subject: order };
  if (filters.sortBy === 'submittedAt') return { submittedAt: order };
  return { submittedAt: filters.sort === 'oldest' ? 'asc' : 'desc' };
};

export const generateContactReferenceCode = async (): Promise<string> => {
  const count = await prisma.contactSubmission.count();
  let attempt = 0;

  while (attempt < 50) {
    const numeric = (count + 1 + attempt).toString().padStart(4, '0');
    const code = `CNT-${numeric}`;
    const existing = await prisma.contactSubmission.findUnique({
      where: { referenceCode: code },
      select: { id: true },
    });
    if (!existing) return code;
    attempt += 1;
  }

  for (let i = 0; i < 20; i += 1) {
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    const code = `CNT-${random}`;
    const existing = await prisma.contactSubmission.findUnique({
      where: { referenceCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }

  throw new ConflictError('Unable to generate a unique contact reference code.');
};

/** Public website response — flat, no admin fields. */
export const serializePublicContact = (submission: ContactSubmission) => ({
  id: submission.id,
  referenceCode: submission.referenceCode,
  fullName: submission.fullName,
  email: submission.email,
  phone: submission.phone,
  subject: submission.subject,
  message: submission.message,
  submittedAt: submission.submittedAt,
  status: submission.status,
});

export const createContactSubmission = async (input: CreateContactSubmissionInput) => {
  const referenceCode = await generateContactReferenceCode();

  let submission = await prisma.contactSubmission.create({
    data: {
      referenceCode,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      subject: input.subject.trim(),
      message: input.message.trim(),
      agreementAccepted: true,
      status: SurveyRegistrationStatus.NEW,
    },
  });

  const emailFlags = await sendContactEmails({
    referenceCode: submission.referenceCode,
    fullName: submission.fullName,
    email: submission.email,
    phone: submission.phone,
    subject: submission.subject,
    message: submission.message,
  });

  if (emailFlags.userEmailSent || emailFlags.adminEmailSent) {
    submission = await prisma.contactSubmission.update({
      where: { id: submission.id },
      data: emailFlags,
    });
  }

  await prisma.auditLog.create({
    data: {
      eventType: 'CONTACT_SUBMISSION_CREATED',
      actorType: ActorType.SYSTEM,
      subjectType: 'ContactSubmission',
      subjectId: submission.id,
      description: `Contact Us submission ${submission.referenceCode} from ${submission.email}.`,
    },
  });

  return serializePublicContact(submission);
};

export const getContactStats = async () => {
  const todayStart = startOfTodayUtc();

  const [total, today, newCount, pending, reviewed, contacted, rejected] = await Promise.all([
    prisma.contactSubmission.count(),
    prisma.contactSubmission.count({ where: { submittedAt: { gte: todayStart } } }),
    prisma.contactSubmission.count({ where: { status: SurveyRegistrationStatus.NEW } }),
    prisma.contactSubmission.count({ where: { status: SurveyRegistrationStatus.PENDING } }),
    prisma.contactSubmission.count({ where: { status: SurveyRegistrationStatus.REVIEWED } }),
    prisma.contactSubmission.count({ where: { status: SurveyRegistrationStatus.CONTACTED } }),
    prisma.contactSubmission.count({ where: { status: SurveyRegistrationStatus.REJECTED } }),
  ]);

  return { total, today, new: newCount, pending, reviewed, contacted, rejected };
};

export const listContactSubmissions = async (filters: ContactSubmissionFilters) => {
  const { page, limit, skip } = parsePageLimit(filters);
  const where = buildWhere(filters);
  const orderBy = buildOrderBy(filters);

  const [total, submissions] = await Promise.all([
    prisma.contactSubmission.count({ where }),
    prisma.contactSubmission.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: { reviewedBy: { select: reviewedBySelect } },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    submissions,
  };
};

export const getContactSubmissionById = async (id: string) => {
  const submission = await prisma.contactSubmission.findUnique({
    where: { id },
    include: { reviewedBy: { select: reviewedBySelect } },
  });

  if (!submission) {
    throw new NotFoundError('Contact submission not found.');
  }

  return submission;
};

export const updateContactSubmission = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateContactSubmissionInput
) => {
  const existing = await prisma.contactSubmission.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Contact submission not found.');
  }

  const statusChanged = input.status !== undefined && input.status !== existing.status;

  const submission = await prisma.contactSubmission.update({
    where: { id },
    data: {
      status: input.status,
      notes: input.notes,
      ...(statusChanged ? { reviewedById: adminId } : {}),
    },
    include: { reviewedBy: { select: reviewedBySelect } },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'CONTACT_SUBMISSION_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'ContactSubmission',
      subjectId: submission.id,
      description: `Updated contact submission ${submission.referenceCode}${
        statusChanged ? ` status → ${submission.status}` : ''
      }.`,
    },
  });

  return submission;
};

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

export const exportContactSubmissionsCsv = async (
  filters: ContactSubmissionFilters
): Promise<string> => {
  const where = buildWhere(filters);
  const orderBy = buildOrderBy(filters);

  const submissions = await prisma.contactSubmission.findMany({ where, orderBy });

  const headers = [
    'Reference',
    'Full Name',
    'Email',
    'Phone',
    'Subject',
    'Message',
    'Submitted',
    'Status',
    'Notes',
  ];

  const rows = submissions.map((s) =>
    [
      s.referenceCode,
      s.fullName,
      s.email,
      s.phone ?? '',
      s.subject,
      s.message,
      s.submittedAt.toISOString(),
      s.status,
      s.notes ?? '',
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
};
