import { Request, RequestHandler } from 'express';
import { uploadMiddleware } from '../uploads/uploads.middleware';

/** Accept profile photo file as `profilePhoto` or `profilePhotoUrl` (mobile alias). */
export const registerUploadMiddleware: RequestHandler = uploadMiddleware.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'profilePhotoUrl', maxCount: 1 },
]);

export const pickRegisterProfilePhoto = (req: Request): Express.Multer.File | undefined => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return files?.profilePhoto?.[0] ?? files?.profilePhotoUrl?.[0] ?? req.file;
};
