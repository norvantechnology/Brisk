import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import * as locationsService from './locations.service';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const handle =
  (message: string, run: (req: Request) => Promise<unknown>, statusCode = 200): Handler =>
  async (req, res, next) => {
    try {
      const data = await run(req);
      sendResponse({ res, statusCode, message, data });
    } catch (error) {
      next(error);
    }
  };

export const listActiveCountries = handle('Countries retrieved.', (req) =>
  locationsService.listActiveCountries(req.query.countryCode as string | undefined)
);

export const adminListCountries = handle('Countries retrieved.', (req) =>
  locationsService.listCountriesForAdmin(req.query.isActive as boolean | undefined)
);

export const adminCreateCountry = handle(
  'Country created.',
  (req) => locationsService.createCountry(req.body),
  201
);

export const adminUpdateCountry = handle('Country updated.', (req) =>
  locationsService.updateCountry(req.params.countryId, req.body)
);

export const adminCreateCounty = handle(
  'County created.',
  (req) => locationsService.createCounty(req.params.countryId, req.body),
  201
);

export const adminUpdateCounty = handle('County updated.', (req) =>
  locationsService.updateCounty(req.params.countyId, req.body)
);
