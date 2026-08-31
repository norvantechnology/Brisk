export const UPLOAD_PURPOSES = [
  'profile_photo',
  'trader_cover',
  'trader_document',
  'category_banner',
  'category_icon',
  'offer_banner',
  'loyalty_image',
  'cms_section_bg',
  'cms_section_fg',
  'cms_section_video',
  'cms_item_image',
  'cms_item_icon',
  'cms_avatar',
  'cms_og_image',
  'blog_cover',
  'knowledge_graphic',
  'knowledge_block_image',
  'address_map_snapshot',
  'meter_reading_photo',
  'job_photo',
] as const;

export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export type UploadActor = {
  kind: 'admin' | 'user';
  id: string;
  role?: 'CUSTOMER' | 'TRADER' | 'ADMIN' | 'SUPER_ADMIN';
};

export type StoredUpload = {
  url: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  purpose: UploadPurpose;
};
