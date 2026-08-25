export type TraderAccountStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';

export type TraderListFilters = {
  page?: string;
  limit?: string;
  search?: string;
  status?: TraderAccountStatus;
  categoryId?: string;
  verification?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  country?: string;
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
