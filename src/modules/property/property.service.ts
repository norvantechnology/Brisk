import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import type { CreateAddressInput, SubmitReadingInput, UpdateAddressInput } from './property.validation';

const PLACEHOLDER = 'https://cdn.brisk.ie/assets/placeholders';

/** Dynamic MPRN / GPRN popup content for My Property help icons. */
export const getMeterHelpTips = () => [
  {
    key: 'mprn',
    title: 'MPRN',
    heading: 'Meter Point Reference Number',
    description:
      'Your Meter Point Reference Number (MPRN) is an 11-digit code usually found on your electricity meter display or bill. It is unique to your property.',
    imageUrl: `${PLACEHOLDER}/meters/mprn-guide.png`,
    meterType: 'electricity',
  },
  {
    key: 'gprn',
    title: 'GPRN',
    heading: 'Gas Point Registration Number',
    description:
      'Your Gas Point Registration Number (GPRN) is a 7 or 8-digit code usually found on your gas meter display or bill. It is unique to your property.',
    imageUrl: `${PLACEHOLDER}/meters/gprn-guide.png`,
    meterType: 'gas',
  },
];

const helpTipByMeterType = (meterType: string) => {
  const tip = getMeterHelpTips().find((item) => item.meterType === meterType);
  if (!tip) return null;
  return {
    key: tip.key,
    title: tip.title,
    heading: tip.heading,
    description: tip.description,
    imageUrl: tip.imageUrl,
  };
};

const formatAddressLine = (input: {
  houseNumber?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  county?: string | null;
  eircode?: string | null;
}) => {
  const parts = [
    [input.houseNumber, input.addressLine1].filter(Boolean).join(' ').trim(),
    input.addressLine2,
    input.city,
    input.county,
    input.eircode,
  ].filter(Boolean);
  return parts.join(', ');
};

const serializeAddress = (address: {
  id: string;
  userId: string;
  label: string | null;
  addressType: string;
  houseNumber: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  county: string | null;
  eircode: string | null;
  country: string;
  mprnNumber: string | null;
  gprnNumber: string | null;
  utnNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  mapImageUrl: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  property?: { id: string } | null;
}) => ({
  id: address.id,
  label: address.label ?? address.addressType,
  addressType: address.addressType,
  houseNumber: address.houseNumber,
  addressLine1: address.addressLine1,
  addressLine2: address.addressLine2,
  city: address.city,
  county: address.county,
  eircode: address.eircode,
  country: address.country,
  mprnNumber: address.mprnNumber,
  gprnNumber: address.gprnNumber,
  utnNumber: address.utnNumber,
  /** Tooltip for MPRN (i) icon — no need to call GET /property/help-tips */
  mprnHelpTip: helpTipByMeterType('electricity'),
  /** Tooltip for GPRN (i) icon — no need to call GET /property/help-tips */
  gprnHelpTip: helpTipByMeterType('gas'),
  latitude: address.latitude,
  longitude: address.longitude,
  mapImageUrl: address.mapImageUrl ?? `${PLACEHOLDER}/maps/address-pin.png`,
  isPrimary: address.isDefault,
  isDefault: address.isDefault,
  fullAddress: formatAddressLine(address),
  propertyId: address.property?.id ?? null,
  createdAt: address.createdAt,
  updatedAt: address.updatedAt,
});

const ensureCustomer = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) throw new NotFoundError('User not found.');
  if (user.role !== 'CUSTOMER') {
    throw new ForbiddenError('Property APIs are for customer accounts.');
  }
  return user;
};

const getOwnedAddress = async (userId: string, id: string) => {
  const address = await prisma.address.findFirst({
    where: { id, userId },
    include: { property: { select: { id: true } } },
  });
  if (!address) throw new NotFoundError('Address not found.');
  return address;
};

const getOwnedProperty = async (userId: string, id: string) => {
  const property = await prisma.property.findFirst({
    where: { id, userId },
    include: {
      address: true,
      meters: {
        include: {
          readings: { orderBy: { readingDate: 'desc' }, take: 1 },
        },
      },
      subscriptions: {
        where: { status: 'active' },
        include: { utilityProvider: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!property) throw new NotFoundError('Property not found.');
  return property;
};

const syncMetersFromAddress = async (
  propertyId: string,
  mprnNumber?: string | null,
  gprnNumber?: string | null
) => {
  if (mprnNumber) {
    const existing = await prisma.meter.findFirst({
      where: { propertyId, meterType: 'electricity' },
    });
    if (existing) {
      await prisma.meter.update({
        where: { id: existing.id },
        data: { mprnGprn: mprnNumber, unitLabel: 'kWh' },
      });
    } else {
      await prisma.meter.create({
        data: {
          propertyId,
          meterType: 'electricity',
          mprnGprn: mprnNumber,
          unitLabel: 'kWh',
        },
      });
    }
  }
  if (gprnNumber) {
    const existing = await prisma.meter.findFirst({
      where: { propertyId, meterType: 'gas' },
    });
    if (existing) {
      await prisma.meter.update({
        where: { id: existing.id },
        data: { mprnGprn: gprnNumber, unitLabel: 'm³' },
      });
    } else {
      await prisma.meter.create({
        data: {
          propertyId,
          meterType: 'gas',
          mprnGprn: gprnNumber,
          unitLabel: 'm³',
        },
      });
    }
  }
};

const upsertPropertyForAddress = async (
  userId: string,
  addressId: string,
  input: {
    label?: string | null;
    addressType: string;
    houseNumber?: string | null;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    county?: string | null;
    eircode?: string | null;
    country?: string;
    mprnNumber?: string | null;
    gprnNumber?: string | null;
  }
) => {
  const propertyName = input.label || input.addressType || 'Home';
  const line1 = [input.houseNumber, input.addressLine1].filter(Boolean).join(' ').trim();

  const existing = await prisma.property.findFirst({ where: { addressId } });
  const property = existing
    ? await prisma.property.update({
        where: { id: existing.id },
        data: {
          propertyName,
          addressLine1: line1 || input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city,
          county: input.county ?? null,
          eircode: input.eircode ?? null,
          country: input.country ?? 'Ireland',
        },
      })
    : await prisma.property.create({
        data: {
          userId,
          addressId,
          propertyName,
          addressLine1: line1 || input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city,
          county: input.county ?? null,
          eircode: input.eircode ?? null,
          country: input.country ?? 'Ireland',
        },
      });

  await syncMetersFromAddress(property.id, input.mprnNumber, input.gprnNumber);
  return property;
};

export const listAddresses = async (userId: string) => {
  await ensureCustomer(userId);
  const addresses = await prisma.address.findMany({
    where: { userId },
    include: { property: { select: { id: true } } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  return addresses.map(serializeAddress);
};

export const getAddress = async (userId: string, id: string) => {
  await ensureCustomer(userId);
  const address = await getOwnedAddress(userId, id);
  return serializeAddress(address);
};

export const createAddress = async (userId: string, input: CreateAddressInput) => {
  await ensureCustomer(userId);

  if (input.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const addressType = input.addressType ?? 'Home';
  const address = await prisma.address.create({
    data: {
      userId,
      addressType,
      label: input.label ?? addressType,
      houseNumber: input.houseNumber,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      county: input.county,
      eircode: input.eircode,
      country: input.country ?? 'Ireland',
      mprnNumber: input.mprnNumber,
      gprnNumber: input.gprnNumber,
      utnNumber: input.utnNumber,
      latitude: input.latitude,
      longitude: input.longitude,
      mapImageUrl: input.mapImageUrl ?? `${PLACEHOLDER}/maps/address-pin.png`,
      isDefault: input.isDefault ?? false,
    },
  });

  await upsertPropertyForAddress(userId, address.id, {
    ...address,
    addressType: address.addressType,
  });

  const withProperty = await getOwnedAddress(userId, address.id);
  return serializeAddress(withProperty);
};

export const updateAddress = async (userId: string, id: string, input: UpdateAddressInput) => {
  await ensureCustomer(userId);
  await getOwnedAddress(userId, id);

  if (input.isDefault === true) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({
    where: { id },
    data: {
      addressType: input.addressType,
      label: input.label,
      houseNumber: input.houseNumber,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      county: input.county,
      eircode: input.eircode,
      country: input.country,
      mprnNumber: input.mprnNumber,
      gprnNumber: input.gprnNumber,
      utnNumber: input.utnNumber,
      latitude: input.latitude,
      longitude: input.longitude,
      mapImageUrl: input.mapImageUrl,
      isDefault: input.isDefault,
    },
  });

  await upsertPropertyForAddress(userId, address.id, address);
  const withProperty = await getOwnedAddress(userId, address.id);
  return serializeAddress(withProperty);
};

export const deleteAddress = async (userId: string, id: string) => {
  await ensureCustomer(userId);
  await getOwnedAddress(userId, id);
  await prisma.address.delete({ where: { id } });
  return { id, deleted: true };
};

const serializeMeter = (meter: {
  id: string;
  meterType: string;
  mprnGprn: string;
  unitLabel: string | null;
  readings: Array<{ readingValue: Prisma.Decimal; readingDate: Date; status: string }>;
}) => {
  const last = meter.readings[0];
  const isElectricity = meter.meterType === 'electricity';
  return {
    id: meter.id,
    meterType: meter.meterType,
    referenceNumber: meter.mprnGprn,
    referenceLabel: isElectricity ? 'MPRN' : 'GPRN',
    unitLabel: meter.unitLabel ?? (isElectricity ? 'kWh' : 'm³'),
    submitLabel: isElectricity
      ? 'Submit your electricity reading'
      : 'Submit your gas reading',
    /** Tooltip for meter (i) icon — embedded so no separate help-tips API call needed */
    helpTip: helpTipByMeterType(meter.meterType),
    lastReading: last
      ? {
          value: Number(last.readingValue),
          formatted: `${Number(last.readingValue).toLocaleString('en-IE')}${
            meter.unitLabel ?? (isElectricity ? ' kWh' : 'm³')
          }`,
          date: last.readingDate,
          status: last.status,
        }
      : null,
  };
};

const serializeSubscription = (sub: {
  id: string;
  serviceType: string;
  status: string;
  utilityProvider: {
    id: string;
    name: string;
    serviceType: string;
    serviceLabel: string | null;
    description: string | null;
    logoUrl: string | null;
    iconUrl: string | null;
  };
}) => ({
  id: sub.id,
  serviceType: sub.serviceType,
  serviceLabel: sub.utilityProvider.serviceLabel ?? sub.serviceType,
  providerId: sub.utilityProvider.id,
  providerName: sub.utilityProvider.name,
  description: sub.utilityProvider.description,
  logoUrl: sub.utilityProvider.logoUrl,
  iconUrl: sub.utilityProvider.iconUrl ?? sub.utilityProvider.logoUrl,
  status: sub.status,
});

export const listProperties = async (userId: string) => {
  await ensureCustomer(userId);
  const properties = await prisma.property.findMany({
    where: { userId },
    include: { address: true },
    orderBy: { createdAt: 'asc' },
  });

  return properties.map((property) => ({
    id: property.id,
    propertyName: property.propertyName,
    addressId: property.addressId,
    addressLine1: property.addressLine1,
    city: property.city,
    county: property.county,
    eircode: property.eircode,
    fullAddress: formatAddressLine(property),
    isPrimary: property.address?.isDefault ?? false,
    label: property.address?.label ?? property.propertyName,
  }));
};

export const getPropertyDetail = async (userId: string, id: string) => {
  await ensureCustomer(userId);
  const property = await getOwnedProperty(userId, id);

  return {
    id: property.id,
    propertyName: property.propertyName,
    addressId: property.addressId,
    fullAddress: formatAddressLine(property),
    label: property.address?.label ?? property.propertyName,
    isPrimary: property.address?.isDefault ?? false,
    meters: property.meters.map(serializeMeter),
    subscriptions: property.subscriptions.map(serializeSubscription),
  };
};

export const submitMeterReading = async (
  userId: string,
  propertyId: string,
  input: SubmitReadingInput
) => {
  await ensureCustomer(userId);
  const property = await getOwnedProperty(userId, propertyId);

  let meter = input.meterId
    ? property.meters.find((item) => item.id === input.meterId)
    : property.meters.find((item) => item.meterType === input.meterType);

  if (!meter) {
    throw new NotFoundError('Meter not found for this property.');
  }

  const reading = await prisma.meterReading.create({
    data: {
      meterId: meter.id,
      userId,
      readingValue: input.readingValue,
      photoUrl: input.photoUrl,
      status: 'accepted',
      readingDate: new Date(),
    },
  });

  const refreshed = await getOwnedProperty(userId, propertyId);
  meter = refreshed.meters.find((item) => item.id === meter!.id)!;

  return {
    reading: {
      id: reading.id,
      meterId: reading.meterId,
      readingValue: Number(reading.readingValue),
      readingDate: reading.readingDate,
      status: reading.status,
      photoUrl: reading.photoUrl,
    },
    meter: serializeMeter(meter),
  };
};

export const listUtilityProviders = async () => {
  const providers = await prisma.utilityProvider.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    serviceType: provider.serviceType,
    serviceLabel: provider.serviceLabel ?? provider.serviceType,
    description: provider.description,
    logoUrl: provider.logoUrl,
    iconUrl: provider.iconUrl ?? provider.logoUrl,
    displayOrder: provider.displayOrder,
  }));
};

export const savePropertySubscriptions = async (
  userId: string,
  propertyId: string,
  providerIds: string[]
) => {
  await ensureCustomer(userId);
  await getOwnedProperty(userId, propertyId);

  const uniqueIds = [...new Set(providerIds)];
  const providers = uniqueIds.length
    ? await prisma.utilityProvider.findMany({
        where: { id: { in: uniqueIds }, isActive: true },
      })
    : [];

  if (providers.length !== uniqueIds.length) {
    throw new BadRequestError('One or more utility providers are invalid.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.deleteMany({ where: { propertyId } });
    if (providers.length) {
      await tx.subscription.createMany({
        data: providers.map((provider) => ({
          propertyId,
          utilityProviderId: provider.id,
          serviceType: provider.serviceType,
          status: 'active',
        })),
      });
    }
  });

  return getPropertyDetail(userId, propertyId);
};
