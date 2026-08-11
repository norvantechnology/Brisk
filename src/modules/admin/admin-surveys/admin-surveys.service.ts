import { prisma } from '../../../config/database';
import { NotFoundError, ConflictError } from '../../../utils/errors';
import {
  ActorType,
  Prisma,
  SurveyRegistrationStatus,
} from '@prisma/client';

// ==========================================
// TYPES
// ==========================================

export type SurveyConsumerFilters = {
  page?: string | number;
  limit?: string | number;
  search?: string;
  status?: string;
  country?: string;
  county?: string;
  ageRange?: string;
  consentLaunchUpdates?: string;
  consentMarketing?: string;
  consentPartnerComm?: string;
  sort?: string;
};

export type UpdateSurveyConsumerInput = {
  status?: SurveyRegistrationStatus;
  notes?: string;
};

export type CreateSurveyConsumerPublicInput = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  county?: string;
  ageRange?: string;
  consentLaunchUpdates?: boolean;
  consentMarketing?: boolean;
  consentPartnerComm?: boolean;
  agreementAccepted: true;
};

export type SurveyTraderFilters = SurveyConsumerFilters;

export type UpdateSurveyTraderInput = UpdateSurveyConsumerInput;

export type CreateSurveyTraderPublicInput = {
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  country: string;
  companyWebsite?: string;
  consentLaunchUpdates?: boolean;
  consentMarketing?: boolean;
  consentPartnerComm?: boolean;
  agreementAccepted: true;
};

// ==========================================
// HELPERS
// ==========================================

const parsePageLimit = (filters: SurveyConsumerFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const parseBoolQuery = (value?: string): boolean | undefined => {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const startOfTodayUtc = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

export const generateRegistrationCode = async (): Promise<string> => {
  const count = await prisma.surveyConsumerRegistration.count();
  let attempt = 0;

  while (attempt < 50) {
    const numeric = (count + 1 + attempt).toString().padStart(4, '0');
    const code = `CS-${numeric}`;
    const existing = await prisma.surveyConsumerRegistration.findUnique({
      where: { registrationCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
    attempt += 1;
  }

  // Fallback: random 6-digit code if sequential range is exhausted/collides
  for (let i = 0; i < 20; i += 1) {
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    const code = `CS-${random}`;
    const existing = await prisma.surveyConsumerRegistration.findUnique({
      where: { registrationCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }

  throw new ConflictError('Unable to generate a unique registration code.');
};

const buildConsumerWhere = (filters: SurveyConsumerFilters): Prisma.SurveyConsumerRegistrationWhereInput => {
  const where: Prisma.SurveyConsumerRegistrationWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { registrationCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (
    filters.status &&
    Object.values(SurveyRegistrationStatus).includes(filters.status as SurveyRegistrationStatus)
  ) {
    where.status = filters.status as SurveyRegistrationStatus;
  }

  if (filters.county) {
    where.county = { equals: filters.county, mode: 'insensitive' };
  }

  if (filters.country) {
    where.country = { equals: filters.country, mode: 'insensitive' };
  }

  if (filters.ageRange) {
    where.ageRange = filters.ageRange;
  }

  const consentLaunchUpdates = parseBoolQuery(filters.consentLaunchUpdates);
  if (consentLaunchUpdates !== undefined) {
    where.consentLaunchUpdates = consentLaunchUpdates;
  }

  const consentMarketing = parseBoolQuery(filters.consentMarketing);
  if (consentMarketing !== undefined) {
    where.consentMarketing = consentMarketing;
  }

  const consentPartnerComm = parseBoolQuery(filters.consentPartnerComm);
  if (consentPartnerComm !== undefined) {
    where.consentPartnerComm = consentPartnerComm;
  }

  return where;
};

const reviewedBySelect = {
  id: true,
  fullName: true,
  email: true,
} as const;

// ==========================================
// STATS
// ==========================================

export const getConsumerStats = async () => {
  const todayStart = startOfTodayUtc();

  const [total, today, newCount, pending, reviewed, contacted, rejected] = await Promise.all([
    prisma.surveyConsumerRegistration.count(),
    prisma.surveyConsumerRegistration.count({
      where: { submittedAt: { gte: todayStart } },
    }),
    prisma.surveyConsumerRegistration.count({
      where: { status: SurveyRegistrationStatus.NEW },
    }),
    prisma.surveyConsumerRegistration.count({
      where: { status: SurveyRegistrationStatus.PENDING },
    }),
    prisma.surveyConsumerRegistration.count({
      where: { status: SurveyRegistrationStatus.REVIEWED },
    }),
    prisma.surveyConsumerRegistration.count({
      where: { status: SurveyRegistrationStatus.CONTACTED },
    }),
    prisma.surveyConsumerRegistration.count({
      where: { status: SurveyRegistrationStatus.REJECTED },
    }),
  ]);

  return {
    total,
    today,
    new: newCount,
    pending,
    reviewed,
    contacted,
    rejected,
  };
};

// ==========================================
// LIST / GET / UPDATE / EXPORT
// ==========================================

export const listConsumers = async (filters: SurveyConsumerFilters) => {
  const { page, limit, skip } = parsePageLimit(filters);
  const where = buildConsumerWhere(filters);
  const orderBy: Prisma.SurveyConsumerRegistrationOrderByWithRelationInput = {
    submittedAt: filters.sort === 'oldest' ? 'asc' : 'desc',
  };

  const [total, registrations] = await Promise.all([
    prisma.surveyConsumerRegistration.count({ where }),
    prisma.surveyConsumerRegistration.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        reviewedBy: { select: reviewedBySelect },
      },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    registrations,
  };
};

export const getConsumerById = async (id: string) => {
  const registration = await prisma.surveyConsumerRegistration.findUnique({
    where: { id },
    include: {
      reviewedBy: { select: reviewedBySelect },
    },
  });

  if (!registration) {
    throw new NotFoundError('Survey consumer registration not found.');
  }

  return registration;
};

export const updateConsumer = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateSurveyConsumerInput
) => {
  const existing = await prisma.surveyConsumerRegistration.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Survey consumer registration not found.');
  }

  const statusChanged =
    input.status !== undefined && input.status !== existing.status;

  const registration = await prisma.surveyConsumerRegistration.update({
    where: { id },
    data: {
      status: input.status,
      notes: input.notes,
      ...(statusChanged ? { reviewedById: adminId } : {}),
    },
    include: {
      reviewedBy: { select: reviewedBySelect },
    },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'SURVEY_CONSUMER_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'SurveyConsumerRegistration',
      subjectId: registration.id,
      description: `Updated survey consumer ${registration.registrationCode}${
        statusChanged ? ` status → ${registration.status}` : ''
      }.`,
    },
  });

  return registration;
};

export const exportConsumersCsv = async (filters: SurveyConsumerFilters): Promise<string> => {
  const where = buildConsumerWhere(filters);
  const orderBy: Prisma.SurveyConsumerRegistrationOrderByWithRelationInput = {
    submittedAt: filters.sort === 'oldest' ? 'asc' : 'desc',
  };

  const registrations = await prisma.surveyConsumerRegistration.findMany({
    where,
    orderBy,
  });

  const headers = [
    'ID',
    'Full Name',
    'Email',
    'Phone',
    'Country',
    'County',
    'Age Range',
    'Launch Updates',
    'Marketing',
    'Partner Comm',
    'Agreement',
    'Submitted',
    'Status',
    'Notes',
  ];

  const rows = registrations.map((r) =>
    [
      r.registrationCode,
      r.fullName,
      r.email,
      r.phone ?? '',
      r.country ?? '',
      r.county ?? '',
      r.ageRange ?? '',
      yesNo(r.consentLaunchUpdates),
      yesNo(r.consentMarketing),
      yesNo(r.consentPartnerComm),
      r.agreementAccepted ? 'Accepted' : 'No',
      r.submittedAt.toISOString(),
      r.status,
      r.notes ?? '',
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
};

// ==========================================
// PUBLIC CREATE
// ==========================================

export const createConsumerRegistration = async (input: CreateSurveyConsumerPublicInput) => {
  const registrationCode = await generateRegistrationCode();

  const registration = await prisma.surveyConsumerRegistration.create({
    data: {
      registrationCode,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      county: input.county,
      ageRange: input.ageRange,
      consentLaunchUpdates: input.consentLaunchUpdates ?? false,
      consentMarketing: input.consentMarketing ?? false,
      consentPartnerComm: input.consentPartnerComm ?? false,
      agreementAccepted: true,
      status: SurveyRegistrationStatus.NEW,
    },
  });

  const { notes: _notes, ...publicRegistration } = registration;
  return publicRegistration;
};

// ==========================================
// TRADER SURVEY — HELPERS
// ==========================================

export const generateTraderRegistrationCode = async (): Promise<string> => {
  const count = await prisma.surveyTraderRegistration.count();
  let attempt = 0;

  while (attempt < 50) {
    const numeric = (count + 1 + attempt).toString().padStart(4, '0');
    const code = `TS-${numeric}`;
    const existing = await prisma.surveyTraderRegistration.findUnique({
      where: { registrationCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
    attempt += 1;
  }

  for (let i = 0; i < 20; i += 1) {
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    const code = `TS-${random}`;
    const existing = await prisma.surveyTraderRegistration.findUnique({
      where: { registrationCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }

  throw new ConflictError('Unable to generate a unique registration code.');
};

const buildTraderWhere = (filters: SurveyTraderFilters): Prisma.SurveyTraderRegistrationWhereInput => {
  const where: Prisma.SurveyTraderRegistrationWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { registrationCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (
    filters.status &&
    Object.values(SurveyRegistrationStatus).includes(filters.status as SurveyRegistrationStatus)
  ) {
    where.status = filters.status as SurveyRegistrationStatus;
  }

  if (filters.country) {
    where.country = { equals: filters.country, mode: 'insensitive' };
  }

  const consentLaunchUpdates = parseBoolQuery(filters.consentLaunchUpdates);
  if (consentLaunchUpdates !== undefined) {
    where.consentLaunchUpdates = consentLaunchUpdates;
  }

  const consentMarketing = parseBoolQuery(filters.consentMarketing);
  if (consentMarketing !== undefined) {
    where.consentMarketing = consentMarketing;
  }

  const consentPartnerComm = parseBoolQuery(filters.consentPartnerComm);
  if (consentPartnerComm !== undefined) {
    where.consentPartnerComm = consentPartnerComm;
  }

  return where;
};

// ==========================================
// TRADER SURVEY — STATS / CRUD / EXPORT
// ==========================================

export const getTraderStats = async () => {
  const todayStart = startOfTodayUtc();

  const [total, today, newCount, pending, reviewed, contacted, rejected] = await Promise.all([
    prisma.surveyTraderRegistration.count(),
    prisma.surveyTraderRegistration.count({
      where: { submittedAt: { gte: todayStart } },
    }),
    prisma.surveyTraderRegistration.count({
      where: { status: SurveyRegistrationStatus.NEW },
    }),
    prisma.surveyTraderRegistration.count({
      where: { status: SurveyRegistrationStatus.PENDING },
    }),
    prisma.surveyTraderRegistration.count({
      where: { status: SurveyRegistrationStatus.REVIEWED },
    }),
    prisma.surveyTraderRegistration.count({
      where: { status: SurveyRegistrationStatus.CONTACTED },
    }),
    prisma.surveyTraderRegistration.count({
      where: { status: SurveyRegistrationStatus.REJECTED },
    }),
  ]);

  return {
    total,
    today,
    new: newCount,
    pending,
    reviewed,
    contacted,
    rejected,
  };
};

export const listTraders = async (filters: SurveyTraderFilters) => {
  const { page, limit, skip } = parsePageLimit(filters);
  const where = buildTraderWhere(filters);
  const orderBy: Prisma.SurveyTraderRegistrationOrderByWithRelationInput = {
    submittedAt: filters.sort === 'oldest' ? 'asc' : 'desc',
  };

  const [total, registrations] = await Promise.all([
    prisma.surveyTraderRegistration.count({ where }),
    prisma.surveyTraderRegistration.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        reviewedBy: { select: reviewedBySelect },
      },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    registrations,
  };
};

export const getTraderById = async (id: string) => {
  const registration = await prisma.surveyTraderRegistration.findUnique({
    where: { id },
    include: {
      reviewedBy: { select: reviewedBySelect },
    },
  });

  if (!registration) {
    throw new NotFoundError('Survey trader registration not found.');
  }

  return registration;
};

export const updateTrader = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateSurveyTraderInput
) => {
  const existing = await prisma.surveyTraderRegistration.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Survey trader registration not found.');
  }

  const statusChanged =
    input.status !== undefined && input.status !== existing.status;

  const registration = await prisma.surveyTraderRegistration.update({
    where: { id },
    data: {
      status: input.status,
      notes: input.notes,
      ...(statusChanged ? { reviewedById: adminId } : {}),
    },
    include: {
      reviewedBy: { select: reviewedBySelect },
    },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'SURVEY_TRADER_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'SurveyTraderRegistration',
      subjectId: registration.id,
      description: `Updated survey trader ${registration.registrationCode}${
        statusChanged ? ` status → ${registration.status}` : ''
      }.`,
    },
  });

  return registration;
};

export const exportTradersCsv = async (filters: SurveyTraderFilters): Promise<string> => {
  const where = buildTraderWhere(filters);
  const orderBy: Prisma.SurveyTraderRegistrationOrderByWithRelationInput = {
    submittedAt: filters.sort === 'oldest' ? 'asc' : 'desc',
  };

  const registrations = await prisma.surveyTraderRegistration.findMany({
    where,
    orderBy,
  });

  const headers = [
    'ID',
    'Full Name',
    'Company Name',
    'Email',
    'Phone',
    'Country',
    'Website',
    'Launch Updates',
    'Marketing',
    'Partner Comm',
    'Agreement',
    'Submitted',
    'Status',
    'Notes',
  ];

  const rows = registrations.map((r) =>
    [
      r.registrationCode,
      r.fullName,
      r.companyName,
      r.email,
      r.phone,
      r.country,
      r.companyWebsite ?? '',
      yesNo(r.consentLaunchUpdates),
      yesNo(r.consentMarketing),
      yesNo(r.consentPartnerComm),
      r.agreementAccepted ? 'Accepted' : 'No',
      r.submittedAt.toISOString(),
      r.status,
      r.notes ?? '',
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
};

export const createTraderRegistration = async (input: CreateSurveyTraderPublicInput) => {
  const registrationCode = await generateTraderRegistrationCode();
  const companyWebsite =
    input.companyWebsite && input.companyWebsite.trim().length > 0
      ? input.companyWebsite.trim()
      : undefined;

  const registration = await prisma.surveyTraderRegistration.create({
    data: {
      registrationCode,
      fullName: input.fullName,
      companyName: input.companyName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      companyWebsite,
      consentLaunchUpdates: input.consentLaunchUpdates ?? false,
      consentMarketing: input.consentMarketing ?? false,
      consentPartnerComm: input.consentPartnerComm ?? false,
      agreementAccepted: true,
      status: SurveyRegistrationStatus.NEW,
    },
  });

  const { notes: _notes, ...publicRegistration } = registration;
  return publicRegistration;
};
