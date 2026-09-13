/**
 * Client DB queries.
 *
 * Naming:
 *   find*   — one row or null
 *   list*   — many rows
 *   search* — typeahead / q search
 *   insert* / update* / deactivate* — writes
 *
 * Files:
 *   clients.ts        — core clients table
 *   client-profile.ts — prefs, health, docs, family, guests, merge
 *   client-audit.ts   — audit log + similar-name RPC
 */
export {
  findClientTierById,
  findClientTierBySlug,
  findDefaultClientTier,
  listActiveClientTiers,
} from "./client-tiers";
export {
  approveClientRecord,
  deactivateClient,
  findClientById,
  findClientDisplayNamesByIds,
  findClientIdsByDisplayName,
  insertClient,
  listClients,
  searchClients,
  updateClient,
  type ClientDirectoryRow,
  type InsertClientInput,
  type ListClientsResult,
  type UpdateClientRecord,
} from "./clients";
export {
  listClientDirectoryFilterValues,
  type ClientDirectoryFilterValues,
  type ClientFilterOwnerOption,
} from "./client-filters";
export {
  clearFamilyPrimary,
  countFamilyMembers,
  deleteClientDocument,
  deleteClientRelationship,
  deleteFamily,
  deleteFamilyMember,
  findClientDocumentById,
  findClientFamily,
  findClientHealth,
  findClientPreferenceById,
  findClientRelationshipById,
  getClientProfileSignals,
  refreshClientProfileCompletenessRpc,
  insertClientDocument,
  insertClientPreference,
  insertClientRelationship,
  insertFamily,
  insertFamilyMember,
  listClientDocuments,
  listClientGuests,
  listClientMergeCandidates,
  listClientPreferences,
  listClientRelationships,
  searchFamilies,
  updateClientDocument,
  updateClientPreference,
  updateFamilyMember,
  updateFamilyName,
  upsertClientHealth,
  type FamilySearchHit,
  type InsertClientDocumentInput,
  type InsertClientPreferenceInput,
  type InsertClientRelationshipInput,
  type InsertFamilyMemberInput,
  type UpdateClientDocumentRecord,
  type UpdateClientPreferenceRecord,
} from "./client-profile";
export {
  findSimilarClients,
  insertClientAuditLogs,
  listClientAuditLogs,
} from "./client-audit";
