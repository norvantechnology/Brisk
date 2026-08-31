import { Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import { BadRequestError } from '../../utils/errors';
import { UploadAuthRequest } from '../../middlewares/upload-auth.middleware';
import * as uploadsService from './uploads.service';
import { UploadPurpose } from './uploads.types';

export const uploadFile = async (
  req: UploadAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.uploadActor) {
      throw new BadRequestError('Upload actor missing.');
    }
    if (!req.file) {
      throw new BadRequestError('Multipart field "file" is required.');
    }

    const purpose = req.body.purpose as UploadPurpose;
    const result = await uploadsService.storeUpload({
      file: req.file,
      purpose,
      actor: req.uploadActor,
      reqHost: req.get('host') ?? undefined,
    });

    sendResponse({
      res,
      statusCode: 201,
      message: 'File uploaded successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFile = async (
  req: UploadAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.uploadActor) {
      throw new BadRequestError('Upload actor missing.');
    }
    await uploadsService.removeUpload(req.body.objectKey, req.uploadActor);
    sendResponse({
      res,
      statusCode: 200,
      message: 'File deleted successfully.',
      data: { objectKey: req.body.objectKey, deleted: true },
    });
  } catch (error) {
    next(error);
  }
};

export const listPurposes = async (
  req: UploadAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { UPLOAD_PURPOSES } = await import('./uploads.types');
    const { PURPOSE_CONFIG, isPurposeAllowed } = await import('./uploads.config');
    const actor = req.uploadActor!;

    const purposes = UPLOAD_PURPOSES.filter((p) => isPurposeAllowed(p, actor)).map((purpose) => ({
      purpose,
      maxBytes: PURPOSE_CONFIG[purpose].maxBytes,
      visibility: PURPOSE_CONFIG[purpose].visibility,
    }));

    sendResponse({
      res,
      statusCode: 200,
      message: 'Upload purposes retrieved successfully.',
      data: { purposes },
    });
  } catch (error) {
    next(error);
  }
};
