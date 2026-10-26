import { ActorType, AdminRole } from '@prisma/client';
import { prisma } from '../../../config/database';
import { ForbiddenError } from '../../../utils/errors';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';

/**
 * Dedicated permission key for viewing/revealing unmasked customer addresses.
 */
export const ADMIN_PERMISSION_VIEW_FULL_ADDRESS = 'VIEW_CUSTOMER_FULL_ADDRESS';

/**
 * Check whether an admin user is authorized to view full customer addresses.
 * Super Admins are granted full access by default.
 * Regular admins require the `VIEW_CUSTOMER_FULL_ADDRESS` permission.
 */
export const canViewCustomerFullAddress = (
  adminUser?: AuthenticatedAdminRequest['adminUser']
): boolean => {
  if (!adminUser) return false;
  if (adminUser.role === AdminRole.SUPER_ADMIN) return true;
  return Array.isArray(adminUser.permissions) && adminUser.permissions.includes(ADMIN_PERMISSION_VIEW_FULL_ADDRESS);
};

/**
 * Enforce address viewing permission or throw ForbiddenError (403).
 */
export const assertCanViewCustomerFullAddress = (
  adminUser?: AuthenticatedAdminRequest['adminUser']
): void => {
  if (!canViewCustomerFullAddress(adminUser)) {
    throw new ForbiddenError(
      'Access denied: You do not have permission to view unmasked customer addresses. Required permission: VIEW_CUSTOMER_FULL_ADDRESS'
    );
  }
};

export interface AuditAddressAccessParams {
  adminUser: NonNullable<AuthenticatedAdminRequest['adminUser']>;
  eventType: 'CUSTOMER_ADDRESS_REVEALED' | 'CUSTOMER_ADDRESS_VIEWED' | 'CUSTOMER_PROPERTY_REVEALED' | 'CUSTOMER_PROPERTY_VIEWED';
  customerId: string;
  subjectType: 'CUSTOMER_ADDRESS' | 'CUSTOMER_PROPERTY' | 'CUSTOMER';
  subjectId: string;
  description?: string;
}

/**
 * Record a security audit log entry whenever an authorized admin reveals or accesses unmasked address data.
 */
export const recordAddressAuditLog = async (params: AuditAddressAccessParams): Promise<void> => {
  const defaultDesc = `Admin ${params.adminUser.fullName} (${params.adminUser.email}) accessed unmasked address for customer ${params.customerId} [${params.subjectType}: ${params.subjectId}]`;
  await prisma.auditLog.create({
    data: {
      eventType: params.eventType,
      actorType: ActorType.ADMIN,
      actorId: params.adminUser.id,
      actorLabel: `${params.adminUser.fullName} (${params.adminUser.role})`,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      description: params.description ?? defaultDesc,
    },
  });
};

/**
 * Mask an individual address object.
 */
export const maskAddressRecord = <T extends Record<string, any>>(addr: T): T & { isMasked: boolean } => {
  const parts = ['XXXXX'];
  if (addr.city) parts.push(addr.city);
  if (addr.county && addr.county !== addr.city) parts.push(addr.county);
  if (addr.country) parts.push(addr.country);
  const maskedFullAddress = parts.join(', ');

  return {
    ...addr,
    houseNumber: addr.houseNumber ? 'XXXXX' : addr.houseNumber,
    addressLine1: 'XXXXX',
    addressLine2: addr.addressLine2 ? 'XXXXX' : addr.addressLine2,
    eircode: addr.eircode ? 'XXXXX' : addr.eircode,
    mprnNumber: addr.mprnNumber ? 'XXXXX' : addr.mprnNumber,
    gprnNumber: addr.gprnNumber ? 'XXXXX' : addr.gprnNumber,
    utnNumber: addr.utnNumber ? 'XXXXX' : addr.utnNumber,
    fullAddress: maskedFullAddress,
    latitude: null,
    longitude: null,
    mapImageUrl: null,
    isMasked: true,
  };
};

/**
 * Mask an individual customer property object.
 */
export const maskPropertyRecord = <T extends Record<string, any>>(prop: T): T & { isMasked: boolean } => {
  const parts = ['XXXXX'];
  if (prop.city) parts.push(prop.city);
  if (prop.county && prop.county !== prop.city) parts.push(prop.county);
  if (prop.country) parts.push(prop.country);
  const maskedFullAddress = parts.join(', ');

  let maskedMeters = prop.meters;
  if (Array.isArray(prop.meters)) {
    maskedMeters = prop.meters.map((m: any) => ({
      ...m,
      referenceNumber: m.referenceNumber ? 'XXXXX' : m.referenceNumber,
      serialNumber: m.serialNumber ? 'XXXXX' : m.serialNumber,
    }));
  }

  return {
    ...prop,
    houseNumber: prop.houseNumber ? 'XXXXX' : prop.houseNumber,
    addressLine1: 'XXXXX',
    addressLine2: prop.addressLine2 ? 'XXXXX' : prop.addressLine2,
    eircode: prop.eircode ? 'XXXXX' : prop.eircode,
    mprnNumber: prop.mprnNumber ? 'XXXXX' : prop.mprnNumber,
    gprnNumber: prop.gprnNumber ? 'XXXXX' : prop.gprnNumber,
    utnNumber: prop.utnNumber ? 'XXXXX' : prop.utnNumber,
    fullAddress: maskedFullAddress,
    latitude: null,
    longitude: null,
    mapImageUrl: null,
    meters: maskedMeters,
    isMasked: true,
  };
};
