import { Router } from 'express';
import { uploadAuthMiddleware } from '../../middlewares/upload-auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './uploads.controller';
import { uploadMiddleware } from './uploads.middleware';
import { deleteUploadSchema, uploadFileSchema } from './uploads.validation';

const router = Router();

router.use(uploadAuthMiddleware);

/**
 * @swagger
 * /uploads/purposes:
 *   get:
 *     summary: List upload purposes allowed for current user/admin
 *     tags: ['Uploads']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Purpose list with max size per type.
 */
router.get('/purposes', controller.listPurposes);

/**
 * @swagger
 * /uploads:
 *   post:
 *     summary: Upload a file (local storage now; S3 later — same response shape)
 *     tags: ['Uploads']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Flow:** `POST /uploads` → get `{ url, objectKey }` → pass **`url`** into existing APIs
 *       (`profilePhotoUrl`, `bannerImageUrl`, `fileUrl`, `imageUrl`, etc.).
 *       When S3 is enabled later, only `url` host changes — mobile/admin keep same integration.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, purpose]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               purpose:
 *                 type: string
 *                 enum: [profile_photo, trader_cover, trader_document, category_banner, category_icon, offer_banner, loyalty_image, cms_section_bg, cms_section_fg, cms_section_video, cms_item_image, cms_item_icon, cms_avatar, cms_og_image, blog_cover, knowledge_graphic, knowledge_block_image, address_map_snapshot, meter_reading_photo, job_photo]
 *     responses:
 *       201:
 *         description: '{ url, objectKey, mimeType, sizeBytes, originalName, purpose }'
 */
router.post(
  '/',
  uploadMiddleware.single('file'),
  validate(uploadFileSchema),
  controller.uploadFile
);

/**
 * @swagger
 * /uploads:
 *   delete:
 *     summary: Delete an uploaded file by objectKey
 *     tags: ['Uploads']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [objectKey]
 *             properties:
 *               objectKey: { type: string, example: 'profile_photo/uuid/1234-abc.jpg' }
 *     responses:
 *       200:
 *         description: File deleted.
 */
router.delete('/', validate(deleteUploadSchema), controller.deleteFile);

export default router;
