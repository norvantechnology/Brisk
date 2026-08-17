import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import * as onboardingService from './onboarding.service';

const handle = (fn: (userId: string, body?: any, params?: any) => Promise<unknown>) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await fn(req.user!.id, req.body, req.params);
      sendResponse({ res, statusCode: 200, message: 'Success', data });
    } catch (error) {
      next(error);
    }
  };

export const getStatus = handle((userId) => onboardingService.getOnboardingStatus(userId));
export const start = handle((userId) => onboardingService.startOnboarding(userId));
export const saveBusinessType = handle((userId, body) => onboardingService.saveBusinessType(userId, body));
export const getRequirements = handle((userId) => onboardingService.getDocumentRequirements(userId));
export const uploadDocument = handle((userId, body) => onboardingService.uploadDocument(userId, body));
export const removeDocument = handle((userId, _body, params) =>
  onboardingService.removeDocument(userId, params.documentRuleId)
);
export const saveCategories = handle((userId, body) => onboardingService.saveCategories(userId, body));
export const saveSoloProfile = handle((userId, body) => onboardingService.saveSoloProfile(userId, body));
export const saveCompanyProfile = handle((userId, body) => onboardingService.saveCompanyProfile(userId, body));
export const saveBankDetails = handle((userId, body) => onboardingService.saveBankDetails(userId, body));
export const saveServiceRadius = handle((userId, body) => onboardingService.saveServiceRadius(userId, body));
export const saveProgress = handle((userId) => onboardingService.saveProgress(userId));
export const submit = handle((userId) => onboardingService.submitOnboarding(userId));
