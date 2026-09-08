/**
 * Studio client business rules.
 * Same layout as lib/team and lib/account — feature folder, kebab-case files.
 */
export { createClient, type CreateClientResult } from "./create-client";
export { approveClient } from "./approve-client";
export { deactivateClient } from "./deactivate-client";
export {
  getClientProfile,
  type ClientProfile,
} from "./client-profile";
export {
  listClientDirectory,
  searchClients,
  CLIENT_DIRECTORY_PAGE_SIZE,
} from "./client-directory";
export {
  getClientDirectoryFilters,
  listRelationshipOwnerOptions,
  EMPTY_CLIENT_DIRECTORY_FILTERS,
  type ClientDirectoryFilters,
  type ClientFilterOption,
  type ClientFilterToggle,
  type ClientAdvancedFilters,
  type RelationshipOwnerOption,
  EMPTY_ADVANCED_FILTERS,
  countAdvancedFilters,
} from "./client-filters";
export {
  getActiveClientTiers,
  pickDefaultClientTierId,
  resolveClientTierId,
  type ClientTierOption,
} from "./client-tiers";
export {
  computeProfileCompleteness,
  listCompletenessHints,
  type CompletenessHint,
  type ProfileCompletenessInput,
} from "./profile-completeness";
export { updateClient } from "./update-client";
export { upsertClientHealth } from "./upsert-client-health";
export {
  createClientPreference,
  updateClientPreference,
} from "./client-preferences";
export {
  leaveClientFamily,
  searchClientFamilies,
  updateClientFamily,
  upsertClientFamily,
} from "./client-family";
export {
  createClientRelationship,
  deleteClientRelationship,
} from "./client-relationships";
export {
  createClientDocument,
  confirmClientDocumentUpload,
  deleteClientDocument,
  getClientDocumentFileUrl,
  updateClientDocument,
  type CreateClientDocumentResult,
} from "./client-documents";
export {
  getClientConfirmConfig,
  type ClientConfirmState,
  type ClientDocumentConfirmAction,
} from "./confirm-dialog-config";
export {
  displayOrDash,
  familySummaryLine,
  formatAddressLines,
  formatAuditAction,
  formatBookingDate,
  formatClientSource,
  formatDietaryLine,
  formatDocumentStatus,
  formatDocumentType,
  formatFamilyRole,
  formatImportantDate,
  formatLanguage,
  formatNationality,
  formatPhone,
  formatPreferenceCategory,
  formatPreferredContact,
  formatRelationshipType,
  formatSentiment,
  formatTimezone,
  formatVipLabel,
  isDocumentExpiringSoon,
  PREFERRED_CONTACT_OPTIONS,
  CLIENT_TITLE_OPTIONS,
  CLIENT_IMPORTANT_DATE_LABEL_OPTIONS,
  clientTitleSelectOptions,
  importantDateLabelSelectOptions,
  normalizeClientTitle,
  sortDocumentsByUrgency,
  titleCaseWords,
} from "./client-format";
