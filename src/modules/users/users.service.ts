import { DeletionRequestStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';
import type { DeactivateAccountInput, UpdateProfileInput } from './users.validation';
import { createAccountDeletionRequest } from './account-deletion.service';
import { withSplitMobileFields } from '../../utils/phone';
import { assertActiveCurrency } from '../../services/currency.service';

const IN_PROGRESS_DELETION_STATUSES: DeletionRequestStatus[] = [
  DeletionRequestStatus.PENDING,
  DeletionRequestStatus.UNDER_REVIEW,
  DeletionRequestStatus.APPROVED,
];

const DEACTIVATION_IN_PROGRESS_MESSAGE =
  'Your account deactivation request is in progress.';

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      customerCode: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      alternatePhone: true,
      profilePhotoUrl: true,
      role: true,
      status: true,
      mobileVerified: true,
      emailVerified: true,
      city: true,
      country: true,
      preferredLanguage: true,
      preferredTimeSlot: true,
      preferredCurrency: true,
      emailNotifications: true,
      smsAlerts: true,
      promoNotifications: true,
      createdAt: true,
      updatedAt: true,
      accountDeletionRequest: {
        select: {
          id: true,
          requestRef: true,
          status: true,
          requestedAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found.');
  }

  const { accountDeletionRequest, ...profile } = user;
  const isDeactivationInProgress = accountDeletionRequest
    ? IN_PROGRESS_DELETION_STATUSES.includes(accountDeletionRequest.status)
    : false;

  return withSplitMobileFields({
    ...profile,
    emailLocked: true,
    isDeactivationInProgress,
    deactivationMessage: isDeactivationInProgress ? DEACTIVATION_IN_PROGRESS_MESSAGE : null,
    deactivationRequestRef: isDeactivationInProgress ? accountDeletionRequest!.requestRef : null,
    deactivationStatus: isDeactivationInProgress ? accountDeletionRequest!.status : null,
    deactivationRequestedAt: isDeactivationInProgress
      ? accountDeletionRequest!.requestedAt
      : null,
  });
};

export const getUserStats = async (userId: string) => {
  const [jobsPosted, savedTradersCount, reviewsGivenCount] = await Promise.all([
    prisma.job.count({ where: { customerId: userId } }),
    prisma.savedTrader.count({ where: { userId } }),
    prisma.ratingReview.count({ where: { customerId: userId } }),
  ]);

  return {
    jobsPosted,
    savedTradersCount,
    reviewsGivenCount,
    avgRating: null,
  };
};

export const updateUserProfile = async (userId: string, input: UpdateProfileInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  if (input.mobileNumber && input.mobileNumber !== user.mobileNumber) {
    const mobileTaken = await prisma.user.findUnique({
      where: { mobileNumber: input.mobileNumber },
    });
    if (mobileTaken && mobileTaken.id !== userId) {
      throw new ConflictError('Mobile number is already registered to another account.');
    }
  }

  if (input.preferredCurrency) {
    await assertActiveCurrency(input.preferredCurrency);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: input.fullName,
      mobileNumber: input.mobileNumber,
      alternatePhone: input.alternatePhone,
      city: input.city,
      country: input.country,
      profilePhotoUrl: input.profilePhotoUrl,
      preferredLanguage: input.preferredLanguage,
      preferredTimeSlot: input.preferredTimeSlot,
      preferredCurrency: input.preferredCurrency,
      emailNotifications: input.emailNotifications,
      smsAlerts: input.smsAlerts,
      promoNotifications: input.promoNotifications,
      mobileVerified:
        input.mobileNumber && input.mobileNumber !== user.mobileNumber
          ? false
          : undefined,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      alternatePhone: true,
      profilePhotoUrl: true,
      city: true,
      country: true,
      preferredLanguage: true,
      preferredTimeSlot: true,
      preferredCurrency: true,
      emailNotifications: true,
      smsAlerts: true,
      promoNotifications: true,
      mobileVerified: true,
      updatedAt: true,
    },
  });

  return withSplitMobileFields({
    ...updatedUser,
    emailLocked: true,
    mobileReverificationRequired:
      input.mobileNumber !== undefined && input.mobileNumber !== user.mobileNumber,
  });
};

export const deactivateUserAccount = async (userId: string, input: DeactivateAccountInput) => {
  return createAccountDeletionRequest(userId, input);
};
