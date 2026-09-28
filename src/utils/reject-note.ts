import { z } from 'zod';

export const REJECT_NOTE_REQUIRED_MESSAGE = 'A note is required when rejecting.';

/** zod superRefine: `noteField` must be non-empty when `status === 'REJECTED'`. */
export const requireNoteWhenRejected =
  <T extends { status?: string | null }>(noteField: keyof T & string) =>
  (body: T, ctx: z.RefinementCtx) => {
    if (body.status !== 'REJECTED') return;
    const note = body[noteField];
    if (typeof note !== 'string' || !note.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: REJECT_NOTE_REQUIRED_MESSAGE,
        path: [noteField],
      });
    }
  };
