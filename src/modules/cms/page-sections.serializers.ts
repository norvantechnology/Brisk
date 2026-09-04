import { CmsPageSection, CmsPageSectionItem, CmsPublishStatus } from '@prisma/client';

const toApiStatus = (status: CmsPublishStatus) => status.toLowerCase();

export const serializePublicSectionItem = (item: CmsPageSectionItem) => {
  const metadata =
    item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : null;

  /** Legacy nested steps under role_workflows cards — expose as first-class array when present. */
  const legacySteps = Array.isArray(metadata?.steps)
    ? (metadata!.steps as Array<Record<string, unknown>>).map((step, index) => ({
        step_number: typeof step.step_number === 'number' ? step.step_number : index + 1,
        title: typeof step.title === 'string' ? step.title : '',
        description: typeof step.description === 'string' ? step.description : '',
        sort_order: typeof step.sort_order === 'number' ? step.sort_order : index + 1,
      }))
    : undefined;

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    image: item.image,
    step_number: item.stepNumber,
    sort_order: item.sortOrder,
    status: toApiStatus(item.status),
    metadata: metadata
      ? Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== 'steps'))
      : null,
    ...(legacySteps ? { steps: legacySteps } : {}),
  };
};

export const serializePublicSection = (
  section: CmsPageSection & { items?: CmsPageSectionItem[] }
) => ({
  id: section.id,
  type: section.sectionType,
  section_type: section.sectionType,
  section_key: section.sectionKey,
  title: section.title,
  subtitle: section.subtitle,
  description: section.description,
  primary_button_text: section.primaryButtonText,
  primary_button_url: section.primaryButtonUrl,
  secondary_button_text: section.secondaryButtonText,
  secondary_button_url: section.secondaryButtonUrl,
  background_image: section.backgroundImage,
  foreground_image: section.foregroundImage,
  background_video: section.backgroundVideo,
  image: section.backgroundImage,
  video: section.backgroundVideo,
  app_store_url: section.appStoreUrl,
  google_play_url: section.googlePlayUrl,
  status: toApiStatus(section.status),
  sort_order: section.sortOrder,
  items: section.items?.map(serializePublicSectionItem) ?? [],
});

export const serializeAdminSectionItem = (item: CmsPageSectionItem) => ({
  id: item.id,
  sectionId: item.sectionId,
  title: item.title,
  description: item.description,
  icon: item.icon,
  image: item.image,
  stepNumber: item.stepNumber,
  sortOrder: item.sortOrder,
  status: item.status,
  metadata: item.metadata ?? null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export const serializeAdminSection = (
  section: CmsPageSection & { items?: CmsPageSectionItem[] }
) => ({
  id: section.id,
  pageId: section.pageId,
  sectionType: section.sectionType,
  sectionKey: section.sectionKey,
  title: section.title,
  subtitle: section.subtitle,
  description: section.description,
  primaryButtonText: section.primaryButtonText,
  primaryButtonUrl: section.primaryButtonUrl,
  secondaryButtonText: section.secondaryButtonText,
  secondaryButtonUrl: section.secondaryButtonUrl,
  backgroundImage: section.backgroundImage,
  foregroundImage: section.foregroundImage,
  backgroundVideo: section.backgroundVideo,
  appStoreUrl: section.appStoreUrl,
  googlePlayUrl: section.googlePlayUrl,
  status: section.status,
  sortOrder: section.sortOrder,
  items: section.items?.map(serializeAdminSectionItem) ?? [],
  createdAt: section.createdAt,
  updatedAt: section.updatedAt,
});
