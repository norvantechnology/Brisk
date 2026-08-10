import { DeletionRequestStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError } from '../../utils/errors';
import type { DeactivateAccountInput } from './users.validation';

const TERMINAL_DELETION_STATUSES: DeletionRequestStatus[] = [
  DeletionRequestStatus.REJECTED,
  DeletionRequestStatus.COMPLETED,
];

export const createAccountDeletionRequest = async (
  userId: string,
  input: DeactivateAccountInput
) => {
  const existingRequest = await prisma.accountDeletionRequest.findUnique({
    where: { userId },
  });

  if (existingRequest && !TERMINAL_DELETION_STATUSES.includes(existingRequest.status)) {
    throw new ConflictError('An account deletion request is already in progress.');
  }

  const activeSubscriptions = await prisma.subscription.count({
    where: {
      status: 'active',
      property: { userId },
    },
  });

  const requestRef = `DEL-${Date.now().toString().slice(-8)}`;

  const deletionRequest = await prisma.accountDeletionRequest.upsert({
    where: { userId },
    create: {
      userId,
      requestRef,
      reason: input.reason,
      additionalComments: input.additionalComments,
      status: DeletionRequestStatus.PENDING,
    },
    update: {
      requestRef,
      reason: input.reason,
      additionalComments: input.additionalComments,
      status: DeletionRequestStatus.PENDING,
      reviewedById: null,
      reviewedByLabel: null,
      processedAt: null,
      requestedAt: new Date(),
    },
  });

  return {
    requestId: deletionRequest.id,
    requestRef: deletionRequest.requestRef,
    status: deletionRequest.status,
    hasActiveSubscriptions: activeSubscriptions > 0,
    activeSubscriptionsCount: activeSubscriptions,
    message:
      'Your account deactivation request has been received. Our team will process it within 24–48 hours in accordance with GDPR compliance protocols.',
    processingWindowHours: '24–48',
  };
};
