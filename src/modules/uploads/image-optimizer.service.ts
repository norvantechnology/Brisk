import path from 'path';
import { UploadPurpose } from './uploads.types';

// Dynamically require sharp so that the backend starts cleanly even before native binaries compile on fresh environments
let sharpInstance: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sharpInstance = require('sharp');
} catch {
  sharpInstance = null;
}

export interface OptimizeImageResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  wasOptimized: boolean;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
}

interface PurposeDimensionConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

/**
 * Real-world dimensional rules:
 * - fit: 'inside' ensures NO cropping / NO cutting. 100% of the image framing and aspect ratio is preserved.
 * - withoutEnlargement: true ensures small images are not upscaled or blurred.
 * - Quality 82-85: Optimal sweet spot where human eye cannot distinguish from uncompressed raw.
 */
const DIMENSION_CONFIG: Record<string, PurposeDimensionConfig> = {
  // Large Hero Banners & Backgrounds (Full HD maximum boundary)
  category_banner: { maxWidth: 1920, maxHeight: 1080, quality: 85 },
  subcategory_banner: { maxWidth: 1920, maxHeight: 1080, quality: 85 },
  offer_banner: { maxWidth: 1920, maxHeight: 1080, quality: 85 },
  cms_section_bg: { maxWidth: 1920, maxHeight: 1080, quality: 85 },
  cms_section_fg: { maxWidth: 1920, maxHeight: 1080, quality: 85 },
  blog_cover: { maxWidth: 1920, maxHeight: 1080, quality: 85 },
  cms_og_image: { maxWidth: 1200, maxHeight: 630, quality: 85 },

  // Avatars, Logos & Icons (Square bounds, preserve full logo/icon)
  profile_photo: { maxWidth: 512, maxHeight: 512, quality: 85 },
  trader_cover: { maxWidth: 1200, maxHeight: 800, quality: 85 },
  category_icon: { maxWidth: 512, maxHeight: 512, quality: 85 },
  cms_avatar: { maxWidth: 512, maxHeight: 512, quality: 85 },
  cms_logo: { maxWidth: 800, maxHeight: 400, quality: 90 },
  cms_footer_logo: { maxWidth: 800, maxHeight: 400, quality: 90 },

  // Job Photos, Completion Proof & Materials (Crisp detail for inspections)
  job_photo: { maxWidth: 1600, maxHeight: 1600, quality: 82 },
  job_proof: { maxWidth: 1600, maxHeight: 1600, quality: 82 },
  job_material: { maxWidth: 1600, maxHeight: 1600, quality: 82 },
  chat_photo: { maxWidth: 1600, maxHeight: 1600, quality: 82 },
  meter_reading_photo: { maxWidth: 1600, maxHeight: 1600, quality: 85 },
};

const DEFAULT_CONFIG: PurposeDimensionConfig = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 82,
};

const replaceExtensionWithWebp = (filename: string): string => {
  const parsed = path.parse(filename);
  return `${parsed.name}.webp`;
};

/**
 * Optimizes an uploaded raster image in-memory:
 * 1. Checks if sharp is available and if file is a compressible raster image (JPEG, PNG, WebP).
 * 2. Auto-orients image based on EXIF camera orientation (prevents upside down phone photos).
 * 3. Strips bloated camera/device metadata for privacy and size reduction.
 * 4. Resizes with fit: 'inside' (NO CROPPING / NO CUTTING).
 * 5. Converts to modern WebP with visual-lossless quality (82-85%).
 * 6. Falls back safely if sharp is unavailable or if conversion fails.
 */
export const optimizeUploadedImage = async (input: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  purpose: UploadPurpose;
}): Promise<OptimizeImageResult> => {
  const { buffer, originalName, mimeType, purpose } = input;
  const originalSizeBytes = buffer.length;

  // Skip SVGs, GIFs (which may be animated), PDFs, and videos
  if (
    !sharpInstance ||
    !mimeType.startsWith('image/') ||
    mimeType === 'image/svg+xml' ||
    mimeType.includes('gif')
  ) {
    return {
      buffer,
      mimeType,
      fileName: originalName,
      wasOptimized: false,
      originalSizeBytes,
      optimizedSizeBytes: originalSizeBytes,
    };
  }

  try {
    const config = DIMENSION_CONFIG[purpose] || DEFAULT_CONFIG;

    // Process image buffer with sharp
    const optimizedBuffer = await sharpInstance(buffer)
      .rotate() // Auto-orient based on EXIF orientation
      .resize({
        width: config.maxWidth,
        height: config.maxHeight,
        fit: 'inside', // PRESERVES 100% OF FRAMING AND ASPECT RATIO — ZERO CUTTING
        withoutEnlargement: true, // Never upscale smaller images to prevent blur
      })
      .webp({
        quality: config.quality,
        effort: 4, // Balanced CPU effort for high compression ratio
      })
      .toBuffer();

    // If optimized buffer is actually smaller, use it
    if (optimizedBuffer.length < originalSizeBytes) {
      return {
        buffer: optimizedBuffer,
        mimeType: 'image/webp',
        fileName: replaceExtensionWithWebp(originalName),
        wasOptimized: true,
        originalSizeBytes,
        optimizedSizeBytes: optimizedBuffer.length,
      };
    }

    return {
      buffer,
      mimeType,
      fileName: originalName,
      wasOptimized: false,
      originalSizeBytes,
      optimizedSizeBytes: originalSizeBytes,
    };
  } catch (error) {
    // If sharp fails for any corrupted or unusual format, gracefully fallback to original
    return {
      buffer,
      mimeType,
      fileName: originalName,
      wasOptimized: false,
      originalSizeBytes,
      optimizedSizeBytes: originalSizeBytes,
    };
  }
};
