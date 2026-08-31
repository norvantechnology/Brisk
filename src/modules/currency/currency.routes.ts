import { Router, Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import { getPublicCurrencySnapshot } from '../admin/admin-currency/admin-currency.service';

const router = Router();

/**
 * @swagger
 * /currency:
 *   get:
 *     summary: Active currencies and exchange rates (mobile picker)
 *     tags: ['Customer / Currency']
 *     description: |
 *       Returns active currencies and rates from platform base currency.
 *       User sets `preferredCurrency` via PATCH /users/profile — affects **new** records only.
 *       Order/payment history always returns the original stored currency.
 *     responses:
 *       200:
 *         description: Currency catalog + rates.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getPublicCurrencySnapshot();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Currencies retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
