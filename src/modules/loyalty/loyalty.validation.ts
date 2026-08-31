import { z } from 'zod';

export const loyaltyOfferIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
