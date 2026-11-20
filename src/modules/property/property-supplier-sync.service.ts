import { randomUUID } from 'crypto';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

export interface PropertySupplierMatch {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  tradingName?: string | null;
  logoUrl?: string | null;
  iconUrl?: string | null;
  description?: string | null;
  typicalService?: string | null;
  coverageSummary?: string | null;
  providesElectricity: boolean;
  providesGas: boolean;
  displayOrder: number;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
    code: string;
    slug: string;
  } | null;
}

/**
 * Normalizes a brand / supplier name for matching across legacy utility providers
 * and master property listed suppliers.
 * Removes parenthesized suffixes (e.g. "(includes Greenstar...)", "(Yuno Ltd)"),
 * common stop-words, and punctuation.
 */
export const normalizeSupplierName = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\b(broadband|recycling|environmental|energy|power|ltd|limited|the|co\.?|ireland)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

/**
 * Matches a utility provider record or subscription against master PropertySupplier list.
 */
export const findMatchingPropertySupplier = (
  utilityProvider: { id?: string; name: string; serviceType?: string },
  suppliers: PropertySupplierMatch[]
): PropertySupplierMatch | null => {
  if (!suppliers || suppliers.length === 0) return null;

  // 1. Exact ID match
  if (utilityProvider.id) {
    const byId = suppliers.find((s) => s.id === utilityProvider.id);
    if (byId) return byId;
  }

  const pName = (utilityProvider.name || '').trim();
  const pNorm = normalizeSupplierName(pName);
  const pType = (utilityProvider.serviceType || '').toLowerCase();

  // 2. Exact name match (case-insensitive)
  const exactNameMatches = suppliers.filter(
    (s) => s.name.trim().toLowerCase() === pName.toLowerCase()
  );
  if (exactNameMatches.length === 1) return exactNameMatches[0];
  if (exactNameMatches.length > 1 && pType) {
    const typeMatch = exactNameMatches.find((s) => {
      const code = s.category?.code?.toUpperCase();
      if (pType === 'electricity') return s.providesElectricity;
      if (pType === 'gas') return s.providesGas;
      if (pType === 'bins') return code === 'WASTE_MANAGEMENT';
      if (pType === 'broadband') return code === 'BROADBAND';
      return true;
    });
    if (typeMatch) return typeMatch;
    return exactNameMatches[0];
  }

  // 3. Trading name match
  const tradingMatch = suppliers.find(
    (s) => s.tradingName && s.tradingName.trim().toLowerCase() === pName.toLowerCase()
  );
  if (tradingMatch) return tradingMatch;

  // 4. Normalized name match
  if (pNorm.length >= 3) {
    const normMatches = suppliers.filter((s) => {
      const sNorm = normalizeSupplierName(s.name);
      return sNorm === pNorm || (sNorm.length >= 3 && (sNorm.includes(pNorm) || pNorm.includes(sNorm)));
    });

    if (normMatches.length === 1) return normMatches[0];
    if (normMatches.length > 1 && pType) {
      const typeMatch = normMatches.find((s) => {
        const code = s.category?.code?.toUpperCase();
        if (pType === 'electricity') return s.providesElectricity;
        if (pType === 'gas') return s.providesGas;
        if (pType === 'bins') return code === 'WASTE_MANAGEMENT';
        if (pType === 'broadband') return code === 'BROADBAND';
        return true;
      });
      if (typeMatch) return typeMatch;
      return normMatches[0];
    }
  }

  return null;
};

let lastSyncTimestamp = 0;
const SYNC_CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Synchronizes all active PropertySupplier records into the UtilityProvider table.
 * Ensures:
 * 1. Newly created suppliers from the admin panel exist in the utility providers catalog.
 * 2. Existing utility providers have updated name, logoUrl, iconUrl, and description from the admin panel.
 * 3. Both mobile client (/properties/:id) and admin customer view show the latest admin data.
 */
export const syncAllSuppliersToUtilityProviders = async (
  db: any = prisma,
  force: boolean = false
): Promise<void> => {
  const now = Date.now();
  if (!force && now - lastSyncTimestamp < SYNC_CACHE_TTL_MS) {
    return;
  }
  lastSyncTimestamp = now;

  try {
    const suppliers: PropertySupplierMatch[] = await db.propertySupplier.findMany({
      where: { isActive: true },
      include: {
        category: {
          select: { id: true, name: true, code: true, slug: true },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    if (!suppliers || suppliers.length === 0) {
      return;
    }

    const existingProviders = await db.utilityProvider.findMany();
    const existingById = new Map<string, any>(existingProviders.map((p: any) => [p.id, p]));

    for (const supplier of suppliers) {
      const services: Array<{ serviceType: string; serviceLabel: string }> = [];
      const catCode = supplier.category?.code?.toUpperCase();

      if (catCode === 'ENERGY') {
        if (supplier.providesElectricity || (!supplier.providesElectricity && !supplier.providesGas)) {
          services.push({ serviceType: 'electricity', serviceLabel: 'Electricity' });
        }
        if (supplier.providesGas) {
          services.push({ serviceType: 'gas', serviceLabel: 'GAS' });
        }
      } else if (catCode === 'WASTE_MANAGEMENT') {
        services.push({ serviceType: 'bins', serviceLabel: 'Bins' });
      } else if (catCode === 'BROADBAND') {
        services.push({ serviceType: 'broadband', serviceLabel: 'Broadband' });
      } else if (catCode === 'INSURANCE') {
        services.push({ serviceType: 'insurance', serviceLabel: 'Home Insurance' });
      } else {
        const sType = catCode ? catCode.toLowerCase() : 'other';
        services.push({ serviceType: sType, serviceLabel: supplier.category?.name || 'Other' });
      }

      for (const service of services) {
        // Find if a utility provider already exists for this service
        let matched = existingProviders.find((p: any) => {
          if (p.serviceType.toLowerCase() !== service.serviceType.toLowerCase()) return false;
          if (p.id === supplier.id) return true;
          return findMatchingPropertySupplier(p, [supplier]) !== null;
        });

        const targetDescription =
          supplier.description || supplier.typicalService || supplier.coverageSummary || null;

        if (matched) {
          // Update existing provider with latest data from admin panel
          await db.utilityProvider.update({
            where: { id: matched.id },
            data: {
              name: supplier.name,
              serviceLabel: service.serviceLabel,
              description: targetDescription || matched.description,
              logoUrl: supplier.logoUrl || matched.logoUrl,
              iconUrl: supplier.iconUrl || matched.iconUrl,
              displayOrder: supplier.displayOrder ?? matched.displayOrder,
              isActive: supplier.isActive,
            },
          });
        } else {
          // Create new utility provider
          // Use supplier.id if available and not yet taken; else generate randomUUID
          const providerId = existingById.has(supplier.id) ? randomUUID() : supplier.id;

          const created = await db.utilityProvider.create({
            data: {
              id: providerId,
              name: supplier.name,
              serviceType: service.serviceType,
              serviceLabel: service.serviceLabel,
              description: targetDescription,
              logoUrl: supplier.logoUrl || null,
              iconUrl: supplier.iconUrl || null,
              displayOrder: supplier.displayOrder ?? 0,
              isActive: supplier.isActive,
            },
          });

          existingById.set(created.id, created);
          existingProviders.push(created);
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to sync property listed suppliers with utility providers:', { error });
  }
};

/**
 * Synchronizes a single supplier on create/update in the admin panel.
 */
export const syncSingleSupplierToUtilityProviders = async (
  supplierId: string,
  db: any = prisma
): Promise<any[]> => {
  lastSyncTimestamp = 0; // Invalidate cache
  try {
    const supplier: PropertySupplierMatch | null = await db.propertySupplier.findUnique({
      where: { id: supplierId },
      include: {
        category: {
          select: { id: true, name: true, code: true, slug: true },
        },
      },
    });

    if (!supplier) return [];

    const existingProviders = await db.utilityProvider.findMany();
    const existingById = new Map<string, any>(existingProviders.map((p: any) => [p.id, p]));
    const result: any[] = [];

    const services: Array<{ serviceType: string; serviceLabel: string }> = [];
    const catCode = supplier.category?.code?.toUpperCase();

    if (catCode === 'ENERGY') {
      if (supplier.providesElectricity || (!supplier.providesElectricity && !supplier.providesGas)) {
        services.push({ serviceType: 'electricity', serviceLabel: 'Electricity' });
      }
      if (supplier.providesGas) {
        services.push({ serviceType: 'gas', serviceLabel: 'GAS' });
      }
    } else if (catCode === 'WASTE_MANAGEMENT') {
      services.push({ serviceType: 'bins', serviceLabel: 'Bins' });
    } else if (catCode === 'BROADBAND') {
      services.push({ serviceType: 'broadband', serviceLabel: 'Broadband' });
    } else if (catCode === 'INSURANCE') {
      services.push({ serviceType: 'insurance', serviceLabel: 'Home Insurance' });
    } else {
      const sType = catCode ? catCode.toLowerCase() : 'other';
      services.push({ serviceType: sType, serviceLabel: supplier.category?.name || 'Other' });
    }

    const targetDescription =
      supplier.description || supplier.typicalService || supplier.coverageSummary || null;

    for (const service of services) {
      let matched = existingProviders.find((p: any) => {
        if (p.serviceType.toLowerCase() !== service.serviceType.toLowerCase()) return false;
        if (p.id === supplier.id) return true;
        return findMatchingPropertySupplier(p, [supplier]) !== null;
      });

      if (matched) {
        const updated = await db.utilityProvider.update({
          where: { id: matched.id },
          data: {
            name: supplier.name,
            serviceLabel: service.serviceLabel,
            description: targetDescription || matched.description,
            logoUrl: supplier.logoUrl || matched.logoUrl,
            iconUrl: supplier.iconUrl || matched.iconUrl,
            displayOrder: supplier.displayOrder ?? matched.displayOrder,
            isActive: supplier.isActive,
          },
        });
        result.push(updated);
      } else {
        const providerId = existingById.has(supplier.id) ? randomUUID() : supplier.id;
        const created = await db.utilityProvider.create({
          data: {
            id: providerId,
            name: supplier.name,
            serviceType: service.serviceType,
            serviceLabel: service.serviceLabel,
            description: targetDescription,
            logoUrl: supplier.logoUrl || null,
            iconUrl: supplier.iconUrl || null,
            displayOrder: supplier.displayOrder ?? 0,
            isActive: supplier.isActive,
          },
        });
        existingById.set(created.id, created);
        result.push(created);
      }
    }

    return result;
  } catch (error) {
    logger.warn(`Failed to sync single property supplier ${supplierId} to utility providers:`, { error });
    return [];
  }
};

/**
 * Deactivates utility providers matching a deleted or deactivated PropertySupplier.
 */
export const deactivateSupplierInUtilityProviders = async (
  supplierId: string,
  db: any = prisma
): Promise<void> => {
  lastSyncTimestamp = 0;
  try {
    const supplier = await db.propertySupplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) return;

    const existingProviders = await db.utilityProvider.findMany({
      where: { isActive: true },
    });

    for (const p of existingProviders) {
      if (p.id === supplier.id || findMatchingPropertySupplier(p, [supplier]) !== null) {
        await db.utilityProvider.update({
          where: { id: p.id },
          data: { isActive: false },
        });
      }
    }
  } catch (error) {
    logger.warn(`Failed to deactivate utility provider for supplier ${supplierId}:`, { error });
  }
};
