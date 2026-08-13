import { Response, NextFunction } from 'express';
import * as contactService from '../../contact/contact.service';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';

export const getStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await contactService.getContactStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Contact submission stats retrieved successfully.',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const listSubmissions = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await contactService.listContactSubmissions(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Contact submissions retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubmission = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const submission = await contactService.getContactSubmissionById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Contact submission retrieved successfully.',
      data: submission,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubmission = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const submission = await contactService.updateContactSubmission(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Contact submission updated successfully.',
      data: submission,
    });
  } catch (error) {
    next(error);
  }
};

export const exportSubmissions = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const csv = await contactService.exportContactSubmissionsCsv(req.query);
    const filename = `contact-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
