import { UploadPurpose } from './uploads.types';

type PurposeConfig = {
  maxBytes: number;
  allowedMime: RegExp;
  visibility: 'public' | 'private';
};

export const PURPOSE_CONFIG: Record<UploadPurpose, PurposeConfig> = {
  profile_photo: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  trader_cover: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  trader_document: {
    maxBytes: 10 * 1024 * 1024,
    allowedMime: /^(image\/|application\/pdf)/,
    visibility: 'private',
  },
  category_banner: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  category_icon: {
    maxBytes: 1 * 1024 * 1024,
    allowedMime: /^(image\/|image\/svg\+xml)/,
    visibility: 'public',
  },
  offer_banner: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  loyalty_image: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  cms_section_bg: { maxBytes: 10 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  cms_section_fg: { maxBytes: 10 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  cms_section_video: {
    maxBytes: 50 * 1024 * 1024,
    allowedMime: /^video\//,
    visibility: 'public',
  },
  cms_item_image: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  cms_item_icon: { maxBytes: 1 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  cms_avatar: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  cms_og_image: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  blog_cover: { maxBytes: 10 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  knowledge_graphic: { maxBytes: 10 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  knowledge_block_image: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'public' },
  address_map_snapshot: { maxBytes: 2 * 1024 * 1024, allowedMime: /^image\//, visibility: 'private' },
  meter_reading_photo: { maxBytes: 5 * 1024 * 1024, allowedMime: /^image\//, visibility: 'private' },
  job_photo: { maxBytes: 10 * 1024 * 1024, allowedMime: /^image\//, visibility: 'private' },
};

const CUSTOMER_PURPOSES: UploadPurpose[] = [
  'profile_photo',
  'address_map_snapshot',
  'meter_reading_photo',
  'job_photo',
];

const TRADER_EXTRA: UploadPurpose[] = ['trader_cover', 'trader_document', 'offer_banner'];

export const isPurposeAllowed = (
  purpose: UploadPurpose,
  actor: { kind: 'admin' | 'user'; role?: string }
) => {
  if (actor.kind === 'admin') return true;
  if (actor.role === 'TRADER') {
    return CUSTOMER_PURPOSES.includes(purpose) || TRADER_EXTRA.includes(purpose);
  }
  return CUSTOMER_PURPOSES.includes(purpose);
};
