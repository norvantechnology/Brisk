import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as service from './admin-traders.service';

export const getStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await service.getTraderDirectoryStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader directory stats retrieved successfully.',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const listTraders = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listTraders(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Traders retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getTrader = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trader = await service.getTraderById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader profile retrieved successfully.',
      data: { trader },
    });
  } catch (error) {
    next(error);
  }
};

export const createTrader = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const trader = await service.createTrader(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Trader created successfully. Default password: Password1!',
      data: { trader },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTrader = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const trader = await service.updateTrader(adminId, adminLabel, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader updated successfully.',
      data: { trader },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTraderStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const trader = await service.updateTraderStatus(adminId, adminLabel, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader status updated successfully.',
      data: { trader },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTraderVerification = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const trader = await service.updateTraderVerification(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader verification updated successfully.',
      data: { trader },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTrader = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    await service.deleteTrader(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader deleted successfully.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
