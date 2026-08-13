import { Request, Response, NextFunction } from 'express';
import { createContactSubmission } from './contact.service';
import { sendResponse } from '../../utils/apiResponse';

export const submitContact = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await createContactSubmission(req.body);
    sendResponse({
      res,
      statusCode: 201,
      message:
        'Thank you for contacting BRISK. Your message has been received. We will respond within 24–48 hours.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
