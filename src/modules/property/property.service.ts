import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { normalizeMediaUrl } from '../categories/categories.serializers';
import { parseFlexibleDate, type CreateAddressInput, type SubmitReadingInput, type UpdateAddressInput } from './property.validation';
import {
  syncAllSuppliersToUtilityProviders,
  findMatchingPropertySupplier,
  type PropertySupplierMatch,
} from './property-supplier-sync.service';

const PLACEHOLDER = 'https://cdn.brisk.ie/assets/placeholders';

export const resolveUtilityIconUrl = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();
  if (
    trimmed.includes('placeholders') ||
    trimmed.includes('cdn.brisk.ie/assets/placeholders') ||
    trimmed.includes('cdn.brisk.com')
  ) {
    return null;
  }
  return normalizeMediaUrl(trimmed);
};

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

export const formatAddressLine = (input: {
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
  /** Icon hint for Select Location: Home | Work | Other */
  icon:
    /home/i.test(address.addressType) || /home/i.test(address.label ?? '')
      ? 'home'
      : /work/i.test(address.addressType) || /work/i.test(address.label ?? '')
        ? 'work'
        : 'other',
  houseNumber: address.houseNumber,
  addressLine1: address.addressLine1,
  addressLine2: address.addressLine2,
  city: address.city,
  county: address.county,
  eircode: address.eircode,
  country: address.country,
  /** Single line for Select Location cards */
  formattedAddress: [
    address.houseNumber,
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.eircode,
  ]
    .filter(Boolean)
    .join(', '),
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
          _count: { select: { readings: true } },
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

const normalizeAddr = (value?: string | null) =>
  (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeEircode = (value?: string | null) =>
  normalizeAddr(value).replace(/\s/g, '');

type AddressMatchInput = {
  id?: string;
  addressId?: string;
  houseNumber?: string | null;
  addressLine1?: string;
  city?: string;
  eircode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * Find an existing saved address for this customer that matches the selection.
 * Used when job location/publish sends the place payload without top-level addressId.
 */
export const findMatchingAddress = async (userId: string, input: AddressMatchInput) => {
  const explicitId = input.addressId || input.id;
  if (explicitId) {
    const owned = await prisma.address.findFirst({
      where: { id: explicitId, userId },
    });
    if (owned) return owned;
  }

  const saved = await prisma.address.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  if (!saved.length) return null;

  const eircode = normalizeEircode(input.eircode);
  if (eircode) {
    const byEircode = saved.find((a) => normalizeEircode(a.eircode) === eircode);
    if (byEircode) return byEircode;
  }

  const line1 = normalizeAddr(input.addressLine1);
  const city = normalizeAddr(input.city);
  const house = normalizeAddr(input.houseNumber);
  if (line1 && city) {
    const byText = saved.find((a) => {
      if (normalizeAddr(a.addressLine1) !== line1) return false;
      if (normalizeAddr(a.city) !== city) return false;
      if (house && normalizeAddr(a.houseNumber) && normalizeAddr(a.houseNumber) !== house) {
        return false;
      }
      return true;
    });
    if (byText) return byText;
  }

  if (
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    // ~40–50m — same pin / same saved place
    const EPS = 0.00045;
    const byGeo = saved.find(
      (a) =>
        a.latitude != null &&
        a.longitude != null &&
        Math.abs(a.latitude - input.latitude!) <= EPS &&
        Math.abs(a.longitude - input.longitude!) <= EPS
    );
    if (byGeo) return byGeo;
  }

  return null;
};

/**
 * Reuse an existing address when the customer selects the same place again;
 * only create when it is genuinely new.
 */
export const findOrCreateAddress = async (userId: string, input: CreateAddressInput & AddressMatchInput) => {
  const match = await findMatchingAddress(userId, input);
  if (match) {
    const withProperty = await getOwnedAddress(userId, match.id);
    return serializeAddress(withProperty);
  }
  return createAddress(userId, input);
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

const mapMeterReadings = (
  meter: { meterType: string; unitLabel?: string | null },
  readings: any[]
) => {
  const isElectricity = meter.meterType === 'electricity';

  return readings.map((r, index) => {
    const rawVal = Number(r.readingValue);
    const formattedValue = isElectricity
      ? rawVal.toLocaleString('en-IE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
      : rawVal.toLocaleString('en-IE');

    const isoDate =
      r.readingDate instanceof Date
        ? r.readingDate.toISOString()
        : new Date(r.readingDate).toISOString();

    return {
      reading: formattedValue,
      date: isoDate,
      isLatest: index === 0,
    };
  });
};

const serializeMeter = (meter: {
  id: string;
  meterType: string;
  mprnGprn: string;
  unitLabel: string | null;
  readings: Array<{
    id?: string;
    readingValue: Prisma.Decimal;
    nightReadingValue?: Prisma.Decimal | null;
    readingType?: string | null;
    readingDate: Date;
    status: string;
    photoUrl?: string | null;
  }>;
  _count?: { readings: number };
}) => {
  const last = meter.readings[0];
  const isElectricity = meter.meterType === 'electricity';
  const unit = meter.unitLabel ?? (isElectricity ? 'kWh' : 'm³');
  const totalReadings = meter._count?.readings ?? (meter.readings ? meter.readings.length : 0);

  const rawLastVal = last ? Number(last.readingValue) : null;
  const formattedLastVal = rawLastVal != null
    ? isElectricity
      ? rawLastVal.toLocaleString('en-IE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
      : rawLastVal.toLocaleString('en-IE')
    : null;

  return {
    id: meter.id,
    meterType: meter.meterType,
    referenceNumber: meter.mprnGprn,
    referenceLabel: isElectricity ? 'MPRN' : 'GPRN',
    unitLabel: unit,
    screenTitle: isElectricity ? 'Submit Electricity Reading' : 'Submit Gas Reading',
    submitLabel: isElectricity
      ? 'Submit your electricity reading'
      : 'Submit your gas reading',
    /** Tooltip for meter (i) icon — embedded so no separate help-tips API call needed */
    helpTip: helpTipByMeterType(meter.meterType),
    totalReadings,
    latestReading: formattedLastVal ? `${formattedLastVal} ${unit}` : null,
    lastReading: last
      ? {
          reading: formattedLastVal!,
          date:
            last.readingDate instanceof Date
              ? last.readingDate.toISOString()
              : new Date(last.readingDate).toISOString(),
          isLatest: true,
        }
      : null,
  };
};

const ensureSampleMeterReadings = async (
  meter: { id: string; meterType: string },
  userId: string
) => {
  const existingCount = await (prisma as any).meterReading.count({
    where: { meterId: meter.id },
  });
  if (existingCount > 0) return;

  const isElectricity = meter.meterType === 'electricity';
  const sampleReadings = isElectricity
    ? [
        { val: 10028.054, date: '2026-11-20' },
        { val: 9995.321, date: '2026-10-20' },
        { val: 9963.87, date: '2026-09-20' },
        { val: 9932.41, date: '2026-08-20' },
        { val: 9901.002, date: '2026-07-20' },
        { val: 9869.499, date: '2026-06-20' },
        { val: 9838.72, date: '2026-05-20' },
        { val: 9807.215, date: '2026-04-20' },
        { val: 9775.983, date: '2026-03-20' },
        { val: 9744.61, date: '2026-02-20' },
        { val: 9713.228, date: '2026-01-20' },
        { val: 9681.904, date: '2025-12-20' },
      ]
    : [
        { val: 120088.0, date: '2026-11-20' },
        { val: 119840.0, date: '2026-10-20' },
        { val: 119610.0, date: '2026-09-20' },
        { val: 119390.0, date: '2026-08-20' },
        { val: 119150.0, date: '2026-07-20' },
        { val: 118920.0, date: '2026-06-20' },
        { val: 118700.0, date: '2026-05-20' },
        { val: 118480.0, date: '2026-04-20' },
      ];

  await (prisma as any).meterReading.createMany({
    data: sampleReadings.map((s) => ({
      meterId: meter.id,
      userId,
      readingValue: s.val,
      readingDate: new Date(s.date),
      status: 'accepted',
      readingType: 'standard',
    })),
  });
};

const meterRefForService = (
  serviceType: string,
  meters: Array<{ meterType: string; mprnGprn: string }>,
  addressRefs?: { mprnNumber?: string | null; gprnNumber?: string | null }
): {
  mprnNumber: string | null;
  gprnNumber: string | null;
  referenceNumber: string | null;
  referenceLabel: string | null;
} => {
  const electricity = meters.find((m) => m.meterType === 'electricity');
  const gas = meters.find((m) => m.meterType === 'gas');
  // Prefer meter values; fall back to address/property saved MPRN/GPRN
  const mprnNumber = electricity?.mprnGprn ?? addressRefs?.mprnNumber ?? null;
  const gprnNumber = gas?.mprnGprn ?? addressRefs?.gprnNumber ?? null;

  if (serviceType === 'electricity') {
    return {
      mprnNumber,
      gprnNumber: null,
      referenceNumber: mprnNumber,
      referenceLabel: mprnNumber ? 'MPRN' : null,
    };
  }
  if (serviceType === 'gas') {
    return {
      mprnNumber: null,
      gprnNumber,
      referenceNumber: gprnNumber,
      referenceLabel: gprnNumber ? 'GPRN' : null,
    };
  }
  return { mprnNumber: null, gprnNumber: null, referenceNumber: null, referenceLabel: null };
};

const serializeSubscription = (
  sub: {
    id: string;
    serviceType: string;
    status: string;
    expiryDate: Date | null;
    accountNumber?: string | null;
    customProviderName?: string | null;
    utilityProvider: {
      id: string;
      name: string;
      serviceType: string;
      serviceLabel: string | null;
      description: string | null;
      logoUrl: string | null;
      iconUrl: string | null;
    };
  },
  meters: Array<{ meterType: string; mprnGprn: string }> = [],
  addressRefs?: { mprnNumber?: string | null; gprnNumber?: string | null },
  matchedSupplier?: PropertySupplierMatch | null
) => {
  const refs = meterRefForService(sub.serviceType, meters, addressRefs);
  const displayName =
    sub.customProviderName || matchedSupplier?.name || sub.utilityProvider.name;
  const description =
    matchedSupplier?.description ||
    matchedSupplier?.typicalService ||
    matchedSupplier?.coverageSummary ||
    sub.utilityProvider.description;
  const logoUrl = normalizeMediaUrl(matchedSupplier?.logoUrl || sub.utilityProvider.logoUrl);
  const iconUrl = resolveUtilityIconUrl(matchedSupplier?.iconUrl || sub.utilityProvider.iconUrl);

  return {
    id: sub.id,
    serviceType: sub.serviceType,
    serviceLabel: sub.utilityProvider.serviceLabel ?? sub.serviceType,
    providerId: sub.utilityProvider.id,
    supplierId: matchedSupplier?.id ?? sub.utilityProvider.id,
    name: displayName,
    providerName: displayName,
    tradingName: matchedSupplier?.tradingName ?? null,
    customProviderName: sub.customProviderName ?? null,
    description,
    logoUrl,
    iconUrl,
    status: sub.status,
    /** ISO date-time (same shape as `createdAt`); null when unset. */
    expiryDate: sub.expiryDate,
    accountNumber: (sub as { accountNumber?: string | null }).accountNumber ?? null,
    mcType: (sub as any).mcType ?? null,
    dgType: (sub as any).dgType ?? null,
    tariffType: (sub as any).tariffType ?? null,
    unitRate: (sub as any).unitRate != null ? Number((sub as any).unitRate) : null,
    standingCharge: (sub as any).standingCharge != null ? Number((sub as any).standingCharge) : null,
    monthlyCost: (sub as any).monthlyCost != null ? Number((sub as any).monthlyCost) : null,
    chargingStructure: (sub as any).chargingStructure ?? null,
    chargingCost: (sub as any).chargingCost != null ? Number((sub as any).chargingCost) : null,
    binDetails: (sub as any).binDetails ?? null,
    billDocumentUrl: (sub as any).billDocumentUrl ?? null,
    vatRate: ['electricity', 'gas'].includes(sub.serviceType.toLowerCase()) ? 0.09 : 0.23,
    mprnNumber: refs.mprnNumber,
    gprnNumber: refs.gprnNumber,
    referenceNumber: refs.referenceNumber,
    referenceLabel: refs.referenceLabel,
    category: matchedSupplier?.category
      ? {
          id: matchedSupplier.category.id,
          name: matchedSupplier.category.name,
          code: matchedSupplier.category.code,
          slug: matchedSupplier.category.slug,
        }
      : null,
    utilityProvider: {
      ...sub.utilityProvider,
      id: sub.utilityProvider.id,
      supplierId: matchedSupplier?.id ?? sub.utilityProvider.id,
      name: displayName,
      providerName: displayName,
      tradingName: matchedSupplier?.tradingName ?? null,
      customProviderName: sub.customProviderName ?? null,
      description,
      logoUrl,
      iconUrl,
    },
  };
};

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
  let property = await getOwnedProperty(userId, id);

  // If address has MPRN/GPRN but meters were never created (legacy data), sync now
  const addressMprn = property.address?.mprnNumber ?? null;
  const addressGprn = property.address?.gprnNumber ?? null;
  const needsMeterSync =
    (addressMprn && !property.meters.some((m) => m.meterType === 'electricity')) ||
    (addressGprn && !property.meters.some((m) => m.meterType === 'gas'));
  if (needsMeterSync) {
    await syncMetersFromAddress(property.id, addressMprn, addressGprn);
    property = await getOwnedProperty(userId, id);
  }

  // Ensure sample readings exist for meters if they currently have 0 readings
  for (const m of property.meters) {
    await ensureSampleMeterReadings(m, userId);
  }
  property = await getOwnedProperty(userId, id);

  const electricityMeter = property.meters.find((m) => m.meterType === 'electricity');
  const gasMeter = property.meters.find((m) => m.meterType === 'gas');
  const mprnNumber =
    property.address?.mprnNumber ?? electricityMeter?.mprnGprn ?? null;
  const gprnNumber =
    property.address?.gprnNumber ?? gasMeter?.mprnGprn ?? null;

  const addressRefs = { mprnNumber, gprnNumber };
  const rawProviders = await listUtilityProviders();

  // Load master property suppliers for enriching subscriptions & catalog
  const propertySuppliers: PropertySupplierMatch[] = await (prisma as any).propertySupplier
    .findMany({
      where: { isActive: true },
      include: {
        category: {
          select: { id: true, name: true, code: true, slug: true },
        },
      },
    })
    .catch(() => []);

  // Enrich all available providers with master supplier data
  const enrichedProviders = rawProviders.map((provider) => {
    const matchedSupplier = findMatchingPropertySupplier(provider, propertySuppliers);
    const displayName = matchedSupplier?.name || provider.name;
    const logoUrl = normalizeMediaUrl(matchedSupplier?.logoUrl || provider.logoUrl);
    const iconUrl = resolveUtilityIconUrl(matchedSupplier?.iconUrl || provider.iconUrl);
    const description =
      matchedSupplier?.description ||
      matchedSupplier?.typicalService ||
      matchedSupplier?.coverageSummary ||
      provider.description;

    return {
      id: provider.id,
      supplierId: matchedSupplier?.id ?? provider.id,
      name: displayName,
      tradingName: matchedSupplier?.tradingName ?? null,
      serviceType: provider.serviceType,
      serviceLabel: provider.serviceLabel ?? provider.serviceType,
      description,
      logoUrl,
      iconUrl,
      displayOrder: provider.displayOrder,
      expiryDate: provider.expiryDate,
    };
  });

  // Track customer's active subscription for each service type
  const activeSubsByService = new Map<string, typeof property.subscriptions[0]>();
  for (const sub of property.subscriptions) {
    if (sub.status === 'active') {
      activeSubsByService.set(sub.serviceType.toLowerCase(), sub);
    }
  }

  // Canonical ordering of service category cards
  const standardServiceTypes = ['electricity', 'gas', 'bins', 'broadband', 'insurance'];
  const allServiceTypes = [
    ...new Set([
      ...standardServiceTypes,
      ...enrichedProviders.map((p) => p.serviceType.toLowerCase()),
    ]),
  ];

  // Produce exactly 1 card item per distinct service category with all providers in providersCategory
  const utilityProviderList = allServiceTypes
    .map((sType) => {
      const seenIds = new Set<string>();
      const providersForService = enrichedProviders
        .filter((p) => p.serviceType.toLowerCase() === sType)
        .filter((p) => {
          if (seenIds.has(p.id)) return false;
          seenIds.add(p.id);
          return true;
        })
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

      if (providersForService.length === 0) return null;

      // Select active provider if customer is subscribed, else default to first
      const activeSub = activeSubsByService.get(sType);
      let primaryProvider = activeSub
        ? providersForService.find((p) => p.id === activeSub.utilityProviderId)
        : null;

      if (!primaryProvider) {
        primaryProvider = providersForService[0];
      }

      return {
        ...primaryProvider,
        providersCategory: providersForService,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    id: property.id,
    propertyName: property.propertyName,
    addressId: property.addressId,
    fullAddress: formatAddressLine(property),
    label: property.address?.label ?? property.propertyName,
    isPrimary: property.address?.isDefault ?? false,
    /** MPRN from address / electricity meter */
    mprnNumber,
    /** GPRN from address / gas meter */
    gprnNumber,
    meters: await Promise.all(
      property.meters.map(async (m) => {
        const readings = await (prisma as any).meterReading.findMany({
          where: { meterId: m.id },
          orderBy: { readingDate: 'desc' },
        });
        return {
          ...serializeMeter({
            ...m,
            readings: readings.slice(0, 1),
            _count: { readings: readings.length },
          }),
          readings: mapMeterReadings(m, readings),
        };
      })
    ),
    subscriptions: property.subscriptions.map((sub) => {
      const matchedSupplier = findMatchingPropertySupplier(sub.utilityProvider, propertySuppliers);
      return serializeSubscription(sub, property.meters, addressRefs, matchedSupplier);
    }),
    utilityProviderList,
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

  const primaryValue = input.readingValue ?? input.dayReadingValue;
  if (primaryValue === undefined || primaryValue === null) {
    throw new BadRequestError('Reading value is required.');
  }

  // Reading values are taken as-is without restricting new reading >= previous reading
  const reading = await (prisma as any).meterReading.create({
    data: {
      meterId: meter.id,
      userId,
      readingValue: primaryValue,
      nightReadingValue: input.nightReadingValue !== undefined ? input.nightReadingValue : null,
      readingType: input.dayReadingValue !== undefined ? 'day_night' : 'standard',
      photoUrl: input.photoUrl,
      status: 'accepted',
      readingDate: new Date(),
    },
  });

  const refreshed = await getOwnedProperty(userId, propertyId);
  meter = refreshed.meters.find((item) => item.id === meter!.id)!;

  const isElectricity = meter.meterType === 'electricity';
  const rawReadingVal = Number(reading.readingValue);
  const formattedVal = isElectricity
    ? rawReadingVal.toLocaleString('en-IE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : rawReadingVal.toLocaleString('en-IE');

  return {
    reading: {
      reading: formattedVal,
      date:
        reading.readingDate instanceof Date
          ? reading.readingDate.toISOString()
          : new Date(reading.readingDate).toISOString(),
      isLatest: true,
    },
    meter: serializeMeter(meter),
  };
};

export const getMeterReadings = async (
  userId: string,
  propertyId: string,
  query: { meterId?: string; meterType?: string }
) => {
  await ensureCustomer(userId);
  let property = await getOwnedProperty(userId, propertyId);

  // If address has MPRN/GPRN but meters were never created (legacy data), sync now
  const addressMprn = property.address?.mprnNumber ?? null;
  const addressGprn = property.address?.gprnNumber ?? null;
  const needsMeterSync =
    (addressMprn && !property.meters.some((m) => m.meterType === 'electricity')) ||
    (addressGprn && !property.meters.some((m) => m.meterType === 'gas'));
  if (needsMeterSync) {
    await syncMetersFromAddress(property.id, addressMprn, addressGprn);
    property = await getOwnedProperty(userId, propertyId);
  }

  // Ensure sample readings exist for meters if they currently have 0 readings
  for (const m of property.meters) {
    await ensureSampleMeterReadings(m, userId);
  }
  property = await getOwnedProperty(userId, propertyId);

  const meter = query.meterId
    ? property.meters.find((item) => item.id === query.meterId)
    : query.meterType
    ? property.meters.find((item) => item.meterType === query.meterType)
    : property.meters[0];

  if (!meter) {
    throw new NotFoundError('Meter not found for this property.');
  }

  const readings = await (prisma as any).meterReading.findMany({
    where: { meterId: meter.id },
    orderBy: { readingDate: 'desc' },
  });

  return {
    meter: serializeMeter({
      ...meter,
      readings: readings.slice(0, 1),
      _count: { readings: readings.length },
    }),
    readings: mapMeterReadings(meter, readings),
  };
};

export const listUtilityProviders = async () => {
  // Ensure any newly added or updated PropertySupplier from admin panel is synced
  await syncAllSuppliersToUtilityProviders(prisma);

  let providers = await prisma.utilityProvider.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  if (providers.length === 0) {
    try {
      const { seedPropertyModule } = await import('../../database/seeders/property.seed');
      await seedPropertyModule(prisma);
      providers = await prisma.utilityProvider.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      });
    } catch {
      // Ignore seeding errors in query path
    }
  }

  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    serviceType: provider.serviceType,
    serviceLabel: provider.serviceLabel ?? provider.serviceType,
    description: provider.description,
    logoUrl: normalizeMediaUrl(provider.logoUrl),
    iconUrl: resolveUtilityIconUrl(provider.iconUrl),
    displayOrder: provider.displayOrder,
    /** ISO date-time (same shape as `createdAt`); null when unset. */
    expiryDate: provider.expiryDate,
  }));
};

/**
 * Sync subscriptions from the Add New Subscription checklist.
 * `providerIds` = currently checked providers (full desired set).
 * - Checked → create/reactivate (status active)
 * - Unchecked (missing from list) → soft-cancel (status cancelled, row kept)
 * No separate DELETE needed for uncheck + Save.
 */
export const savePropertySubscriptions = async (
  userId: string,
  propertyId: string,
  input:
    | string[]
    | {
        providerIds?: string[];
        subscriptions?: Array<{
          providerId: string;
          name?: string | null;
          providerName?: string | null;
          customProviderName?: string | null;
          expiryDate?: string | Date | number | null;
          accountNumber?: string | null;
          mcType?: string | null;
          dgType?: string | null;
          tariffType?: string | null;
          unitRate?: number | null;
          standingCharge?: number | null;
          monthlyCost?: number | null;
          chargingStructure?: string | null;
          chargingCost?: number | null;
          binDetails?: any;
          billDocumentUrl?: string | null;
          mprnNumber?: string | null;
          gprnNumber?: string | null;
        }>;
      }
) => {
  await ensureCustomer(userId);
  await getOwnedProperty(userId, propertyId);

  const rawProviderIds = Array.isArray(input)
    ? input
    : input.subscriptions?.map((s) => s.providerId) ?? input.providerIds ?? [];

  const subItems = Array.isArray(input) ? null : input.subscriptions ?? null;
  const uniqueIds = [...new Set(rawProviderIds)];

  // Ensure suppliers are synced
  await syncAllSuppliersToUtilityProviders(prisma);

  let providers = uniqueIds.length
    ? await prisma.utilityProvider.findMany({
        where: { id: { in: uniqueIds } },
      })
    : [];

  const providerMap = new Map<string, typeof providers[0]>();
  for (const p of providers) {
    providerMap.set(p.id, p);
  }

  // If any input IDs were not found as UtilityProvider, check if they are PropertySupplier IDs
  if (providers.length !== uniqueIds.length) {
    const foundIds = new Set(providers.map((p) => p.id));
    const missingIds = uniqueIds.filter((id) => !foundIds.has(id));

    const suppliers: PropertySupplierMatch[] = await (prisma as any).propertySupplier
      .findMany({
        where: { id: { in: missingIds } },
        include: { category: true },
      })
      .catch(() => []);

    for (const sup of suppliers) {
      const matchedP = await prisma.utilityProvider.findFirst({
        where: {
          OR: [
            { id: sup.id },
            { name: { equals: sup.name, mode: 'insensitive' } },
          ],
        },
      });
      if (matchedP) {
        providerMap.set(sup.id, matchedP);
        if (!providers.some((p) => p.id === matchedP.id)) {
          providers.push(matchedP);
        }
      }
    }
  }

  // Check if every input ID resolved to a valid provider
  const resolvedAll = uniqueIds.every((id) => providerMap.has(id) || providers.some((p) => p.id === id));
  if (!resolvedAll) {
    const missingIds = uniqueIds.filter((id) => !providerMap.has(id) && !providers.some((p) => p.id === id));
    throw new BadRequestError(`Invalid or unknown utility provider ID(s): ${missingIds.join(', ')}`);
  }

  const effectiveProviderIds = [...new Set(providers.map((p) => p.id))];

  await prisma.$transaction(async (tx) => {
    // Soft-cancel any active subscription whose provider is not in the checked list
    await tx.subscription.updateMany({
      where: {
        propertyId,
        status: 'active',
        ...(effectiveProviderIds.length
          ? { utilityProviderId: { notIn: effectiveProviderIds } }
          : {}),
      },
      data: { status: 'cancelled' },
    });

    // Also soft-cancel any previous active subscription of the same serviceType whose provider was replaced
    const activatedServices = [...new Set(providers.map((p) => p.serviceType.toLowerCase()))];
    for (const sType of activatedServices) {
      const allowedIdsForService = providers
        .filter((p) => p.serviceType.toLowerCase() === sType)
        .map((p) => p.id);
      await tx.subscription.updateMany({
        where: {
          propertyId,
          status: 'active',
          serviceType: { equals: sType, mode: 'insensitive' },
          utilityProviderId: { notIn: allowedIdsForService },
        },
        data: { status: 'cancelled' },
      });
    }

    // Activate / create each checked provider
    for (const provider of providers) {
      const customSub = subItems?.find(
        (s) => s.providerId === provider.id || providerMap.get(s.providerId)?.id === provider.id
      );
      const expiryDate =
        customSub?.expiryDate !== undefined
          ? parseFlexibleDate(customSub.expiryDate)
          : provider.expiryDate;
      const accountNumber = customSub?.accountNumber ?? undefined;
      const customProviderName =
        customSub?.providerName !== undefined
          ? (customSub.providerName?.trim() || null)
          : (customSub as { name?: string | null })?.name !== undefined
          ? ((customSub as { name?: string | null }).name?.trim() || null)
          : customSub?.customProviderName !== undefined
          ? (customSub.customProviderName?.trim() || null)
          : undefined;

      await (tx as any).subscription.upsert({
        where: {
          propertyId_utilityProviderId: {
            propertyId,
            utilityProviderId: provider.id,
          },
        },
        create: {
          propertyId,
          utilityProviderId: provider.id,
          serviceType: provider.serviceType,
          status: 'active',
          accountNumber,
          expiryDate,
          customProviderName: customProviderName ?? null,
          mcType: customSub?.mcType ?? null,
          dgType: customSub?.dgType ?? null,
          tariffType: customSub?.tariffType ?? null,
          unitRate: customSub?.unitRate != null ? customSub.unitRate : null,
          standingCharge: customSub?.standingCharge != null ? customSub.standingCharge : null,
          monthlyCost: customSub?.monthlyCost != null ? customSub.monthlyCost : null,
          chargingStructure: customSub?.chargingStructure ?? null,
          chargingCost: customSub?.chargingCost != null ? customSub.chargingCost : null,
          binDetails: customSub?.binDetails ?? undefined,
          billDocumentUrl: customSub?.billDocumentUrl ?? null,
        },
        update: {
          status: 'active',
          serviceType: provider.serviceType,
          ...(customSub?.expiryDate !== undefined ? { expiryDate } : {}),
          ...(customSub?.accountNumber !== undefined ? { accountNumber } : {}),
          ...(customProviderName !== undefined ? { customProviderName } : {}),
          ...(customSub?.mcType !== undefined ? { mcType: customSub.mcType } : {}),
          ...(customSub?.dgType !== undefined ? { dgType: customSub.dgType } : {}),
          ...(customSub?.tariffType !== undefined ? { tariffType: customSub.tariffType } : {}),
          ...(customSub?.unitRate !== undefined ? { unitRate: customSub.unitRate } : {}),
          ...(customSub?.standingCharge !== undefined ? { standingCharge: customSub.standingCharge } : {}),
          ...(customSub?.monthlyCost !== undefined ? { monthlyCost: customSub.monthlyCost } : {}),
          ...(customSub?.chargingStructure !== undefined ? { chargingStructure: customSub.chargingStructure } : {}),
          ...(customSub?.chargingCost !== undefined ? { chargingCost: customSub.chargingCost } : {}),
          ...(customSub?.binDetails !== undefined ? { binDetails: customSub.binDetails } : {}),
          ...(customSub?.billDocumentUrl !== undefined ? { billDocumentUrl: customSub.billDocumentUrl } : {}),
        },
      });

      if (customSub?.mprnNumber || customSub?.gprnNumber) {
        await syncMetersFromAddress(propertyId, customSub.mprnNumber, customSub.gprnNumber);
      }
    }
  });

  return getPropertyDetail(userId, propertyId);
};

export const removePropertySubscription = async (
  userId: string,
  propertyId: string,
  subscriptionId: string
) => {
  await ensureCustomer(userId);
  await getOwnedProperty(userId, propertyId);

  const existing = await prisma.subscription.findFirst({
    where: { id: subscriptionId, propertyId },
  });
  if (!existing) {
    throw new NotFoundError('Subscription not found for this property.');
  }

  // Soft delete — keep row for audit / future backup; hide from active list via status.
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: 'cancelled' },
  });

  return getPropertyDetail(userId, propertyId);
};
