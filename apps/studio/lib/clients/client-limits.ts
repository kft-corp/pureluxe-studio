/** Caps for nested lists on the Studio client profile aggregate. */
export const PROFILE_LIST_LIMITS = {
  preferences: 100,
  documents: 50,
  relationships: 50,
  mergeCandidates: 10,
  audit: 5,
} as const;

/** Directory default page size (UI + API alignment). */
export const CLIENT_DIRECTORY_PAGE_SIZE = 10;
