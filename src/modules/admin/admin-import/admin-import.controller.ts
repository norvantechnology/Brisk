import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { BadRequestError } from '../../../utils/errors';
import * as importService from './admin-import.service';
import { ImportMode } from './admin-import.types';

export const importCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      throw new BadRequestError('File is required. Please upload an Excel (.xlsx, .xls) or CSV file.');
    }

    const mode: ImportMode = (req.body.mode || req.query.mode) === 'upsert' ? 'upsert' : 'skip';
    const rows = importService.parseBufferToRows(req.file.buffer);

    if (rows.length === 0) {
      throw new BadRequestError('The uploaded file contains no data rows.');
    }

    const result = await importService.importCategories(rows, mode);

    sendResponse({
      res,
      statusCode: 200,
      message: `Category import completed: ${result.summary.importedCount} imported, ${result.summary.updatedCount} updated, ${result.summary.skippedCount} skipped, ${result.summary.failedCount} failed.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const importSubcategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      throw new BadRequestError('File is required. Please upload an Excel (.xlsx, .xls) or CSV file.');
    }

    const mode: ImportMode = (req.body.mode || req.query.mode) === 'upsert' ? 'upsert' : 'skip';
    const rows = importService.parseBufferToRows(req.file.buffer);

    if (rows.length === 0) {
      throw new BadRequestError('The uploaded file contains no data rows.');
    }

    const result = await importService.importSubcategories(rows, mode);

    sendResponse({
      res,
      statusCode: 200,
      message: `Subcategory import completed: ${result.summary.importedCount} imported, ${result.summary.updatedCount} updated, ${result.summary.skippedCount} skipped, ${result.summary.failedCount} failed.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawEntity = String(req.params.entity || req.query.entity || 'categories').toLowerCase();
    const entity = rawEntity.includes('sub') ? 'subcategories' : 'categories';
    const format = String(req.query.format || 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';

    const { buffer, filename, mimeType } = importService.generateTemplate(entity, format);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};
