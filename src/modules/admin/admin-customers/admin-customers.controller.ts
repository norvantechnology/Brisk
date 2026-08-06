import { Response, NextFunction } from 'express';
import * as customerAdminService from './admin-customers.service';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';

// ==========================================
// CUSTOMER DIRECTORY CONTROLLERS
// ==========================================

export const getCustomerDirectoryStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await customerAdminService.getCustomerDirectoryStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer directory stats retrieved successfully.',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const listCustomers = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await customerAdminService.listCustomers(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customers retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customer = await customerAdminService.getCustomerById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer profile retrieved successfully.',
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const customer = await customerAdminService.createCustomer(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Customer profile created successfully.',
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const customer = await customerAdminService.updateCustomer(adminId, adminLabel, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer profile updated successfully.',
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    await customerAdminService.deleteCustomer(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer profile deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ACCOUNT DELETION REQUESTS CONTROLLERS
// ==========================================

export const getDeletionRequestStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await customerAdminService.getDeletionRequestStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Deletion request stats retrieved successfully.',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const listDeletionRequests = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await customerAdminService.listDeletionRequests(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Account deletion requests retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getDeletionRequest = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const request = await customerAdminService.getDeletionRequestById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Account deletion request retrieved successfully.',
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

export const updateDeletionRequest = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const request = await customerAdminService.updateDeletionRequestStatus(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Account deletion request status updated successfully.',
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PAYMENT & BILLING MANAGEMENT CONTROLLERS
// ==========================================

export const getCustomerPaymentHeaderStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await customerAdminService.getCustomerPaymentHeaderStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer payment header stats retrieved successfully.',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const listPaymentTransactions = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await customerAdminService.listPaymentTransactions(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment transactions retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransaction = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const transaction = await customerAdminService.getTransactionById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment transaction detail retrieved successfully.',
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

export const listBillingInvoices = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await customerAdminService.listBillingInvoices(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Billing invoices retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getInvoice = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const invoice = await customerAdminService.getInvoiceById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Tax invoice detail retrieved successfully.',
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

export const listRefundsQueue = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await customerAdminService.listRefundsQueue(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Refunds management queue retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const processRefund = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const refund = await customerAdminService.processRefund(adminId, adminLabel, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Refund processed successfully.',
      data: { refund },
    });
  } catch (error) {
    next(error);
  }
};

export const getLoyaltyRewardsSummary = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const summary = await customerAdminService.getLoyaltyRewardsSummary();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty & rewards summary retrieved successfully.',
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

