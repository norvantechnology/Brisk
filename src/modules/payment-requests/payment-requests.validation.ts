import { z } from 'zod';

const uuid = z.string().uuid();

export const jobIdParamSchema = z.object({
  params: z.object({ id: uuid }),
});
