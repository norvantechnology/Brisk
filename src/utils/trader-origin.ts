import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { BadRequestError } from './errors';

export type Origin = { lat: number; lng: number };

export const DUBLIN_ORIGIN: Origin = { lat: 53.3498, lng: -6.2603 };

/** Prefer recent Discover GPS over a stale / wrong service-centre pin. */
const LAST_DEVICE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

type OriginTrader = {
  id?: string;
  serviceCenterLat: Prisma.Decimal | number | null;
  serviceCenterLng: Prisma.Decimal | number | null;
  lastDeviceLat?: Prisma.Decimal | number | null;
  lastDeviceLng?: Prisma.Decimal | number | null;
  lastDeviceAt?: Date | null;
};

/**
 * Distance origin (same rules for Discover + incoming / `job:accept`):
 * 1) request `lat`/`lng` (device GPS)
 * 2) last device GPS saved from a recent Discover/incoming call
 * 3) trader service centre
 * 4) Dublin fallback
 */
export const resolveTraderOrigin = (
  trader: OriginTrader,
  lat?: string | number | null,
  lng?: string | number | null
): Origin => {
  if (lat != null && lng != null && lat !== '' && lng !== '') {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      return { lat: parsedLat, lng: parsedLng };
    }
    throw new BadRequestError('lat and lng must be valid numbers.');
  }

  if (
    trader.lastDeviceLat != null &&
    trader.lastDeviceLng != null &&
    trader.lastDeviceAt &&
    Date.now() - trader.lastDeviceAt.getTime() <= LAST_DEVICE_MAX_AGE_MS
  ) {
    return {
      lat: Number(trader.lastDeviceLat),
      lng: Number(trader.lastDeviceLng),
    };
  }

  if (trader.serviceCenterLat != null && trader.serviceCenterLng != null) {
    return {
      lat: Number(trader.serviceCenterLat),
      lng: Number(trader.serviceCenterLng),
    };
  }

  return DUBLIN_ORIGIN;
};

/** Persist device GPS so socket `job:accept` distance matches the Discover card. */
export const rememberTraderDeviceOrigin = async (
  traderId: string,
  lat?: string | number | null,
  lng?: string | number | null
): Promise<void> => {
  if (lat == null || lng == null || lat === '' || lng === '') return;
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return;

  await prisma.trader.update({
    where: { id: traderId },
    data: {
      lastDeviceLat: parsedLat,
      lastDeviceLng: parsedLng,
      lastDeviceAt: new Date(),
    },
  });
};
