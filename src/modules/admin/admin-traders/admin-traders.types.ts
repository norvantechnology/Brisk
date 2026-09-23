export type TraderAccountStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';

export type TraderVerificationFilter = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export type TraderListFilters = {
  page?: string;
  limit?: string;
  search?: string;
  status?: TraderAccountStatus;
  categoryId?: string;
  /** Preferred list filter (also accepted as verificationStatus). */
  verification?: TraderVerificationFilter;
  /** Alias used by Admin FE — same as verification. */
  verificationStatus?: TraderVerificationFilter;
  onboardingStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  pendingApproval?: boolean;
  country?: string;
  /** Inclusive start of trader.createdAt (ISO date or datetime). */
  joinedFrom?: string;
  /** Inclusive end of trader.createdAt (ISO date or datetime). */
  joinedTo?: string;
};

export type TraderStatsFilters = {
  /** Optional window for newTraders; default = start of current calendar month → now. */
  joinedFrom?: string;
  joinedTo?: string;
};

export type CreateTraderInput = {
  fullName: string;
  email: string;
  mobileNumber: string;
  traderType?: 'SOLO' | 'COMPANY';
  businessName?: string;
  fullLegalName?: string;
  country?: string;
  city?: string;
  status?: TraderAccountStatus;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  categoryIds?: string[];
  profilePhotoUrl?: string;
  yearsExperience?: number;
  bio?: string;
};

export type UpdateTraderInput = {
  fullName?: string;
  email?: string;
  mobileNumber?: string;
  traderType?: 'SOLO' | 'COMPANY';
  businessName?: string | null;
  fullLegalName?: string | null;
  country?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postcode?: string | null;
  status?: TraderAccountStatus;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  categoryIds?: string[];
  profilePhotoUrl?: string | null;
  yearsExperience?: number;
  bio?: string | null;
  serviceRadiusKm?: number | null;
};

export type UpdateTraderStatusInput = {
  status: TraderAccountStatus;
};

export type UpdateTraderVerificationInput = {
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  rejectionReason?: string;
};
