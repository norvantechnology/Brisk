import { BadRequestError, ForbiddenError } from '../../utils/errors';
import { isPurposeAllowed, PURPOSE_CONFIG } from './uploads.config';
import { deleteLocalUpload, saveLocalUpload } from './storage/local.storage';
import { UploadActor, UploadPurpose } from './uploads.types';
import { optimizeUploadedImage } from './image-optimizer.service';

export const storeUpload = async (input: {
  file: Express.Multer.File;
  purpose: UploadPurpose;
  actor: UploadActor;
  reqHost?: string;
}) => {
  const { file, purpose, actor } = input;
  if (!file) {
    throw new BadRequestError('File is required.');
  }

  if (!isPurposeAllowed(purpose, actor)) {
    const traderOnboardingHint =
      actor.kind === 'user' &&
      actor.role === 'TRADER' &&
      (purpose === 'category_banner' || purpose === 'category_icon')
        ? ' Use purpose "trader_document" for trader onboarding documents.'
        : '';
    throw new ForbiddenError(
      `You are not allowed to upload files for purpose "${purpose}".${traderOnboardingHint}`
    );
  }

  const config = PURPOSE_CONFIG[purpose];
  if (!config.allowedMime.test(file.mimetype)) {
    throw new BadRequestError(`File type "${file.mimetype}" is not allowed for ${purpose}.`);
  }
  const maxBytes =
    config.videoMaxBytes && file.mimetype.startsWith('video/') ? config.videoMaxBytes : config.maxBytes;
  if (file.size > maxBytes) {
    throw new BadRequestError(`File exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  }

  const ownerId = actor.id;

  // Real-world upload-time optimization: compress and convert raster images to WebP without cropping
  let bufferToSave = file.buffer;
  let mimeTypeToSave = file.mimetype;
  let originalNameToSave = file.originalname;

  if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
    const optimized = await optimizeUploadedImage({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      purpose,
    });
    if (optimized.wasOptimized) {
      bufferToSave = optimized.buffer;
      mimeTypeToSave = optimized.mimeType;
      originalNameToSave = optimized.fileName;
    }
  }

  // Future: if env.UPLOAD_STORAGE === 's3' → s3.storage.ts (same return shape)
  return saveLocalUpload({
    buffer: bufferToSave,
    purpose,
    ownerId,
    originalName: originalNameToSave,
    mimeType: mimeTypeToSave,
    reqHost: input.reqHost,
  });
};

export const removeUpload = async (objectKey: string, actor: UploadActor) => {
  if (!objectKey || objectKey.includes('..')) {
    throw new BadRequestError('Invalid objectKey.');
  }

  const ownerSegment = objectKey.split('/')[1];
  const isOwner = ownerSegment === actor.id;
  const isAdmin = actor.kind === 'admin';

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You cannot delete this file.');
  }

  await deleteLocalUpload(objectKey);
};
