/** Client directory and profile copy. */
export const clientMessages = {
  success: {
    created: "Client created. They're pending approval before trips.",
    updated: "Client details saved.",
    deactivated: "Client deactivated and removed from the active directory.",
    healthUpdated: "Health and accessibility details saved.",
    approved: "Client approved. They're ready for trips.",
    preferenceCreated: "Preference added.",
    preferenceUpdated: "Preference updated.",
    preferenceConfirmed: "Preference confirmed.",
    preferenceRemoved: "Preference removed.",
    familyCreated: "Household created.",
    familyJoined: "Joined the household.",
    familyUpdated: "Household updated.",
    familyLeft: "Left the household.",
    memberAdded: "Household member added.",
    memberRemoved: "Household member removed.",
    relationshipCreated: "Related person linked.",
    relationshipRemoved: "Related person removed.",
    documentCreated: "Document uploaded — pending review.",
    documentUpdated: "Document updated.",
    documentVerified: "Document verified.",
    documentRejected: "Document rejected.",
    documentRemoved: "Document removed.",
  },
  error: {
    notFound: "We couldn't find that client. It may have been deactivated.",
    preferenceNotFound:
      "We couldn't find that preference. Refresh and try again.",
    familyNotFound:
      "We couldn't find that household. It may have been removed.",
    relationshipNotFound:
      "We couldn't find that relationship. Refresh and try again.",
    documentNotFound:
      "We couldn't find that document. It may have been removed.",
    documentNoFile: "This document has no file attached yet.",
    documentUploadFailed:
      "We couldn't prepare the upload. Check your connection and try again.",
    documentTransferFailed: "We couldn't upload the file. Try again.",
    documentDownloadFailed:
      "We couldn't open that file. Check your connection and try again.",
    documentFileType: "Upload a PDF or image (JPEG, PNG, or WebP).",
    documentFileTooLarge: "That file is too large. Keep it under 10 MB.",
    alreadyInFamily: "This client is already in a household.",
    notInFamily: "This client isn't in a household yet.",
    targetAlreadyInFamily: "That person already belongs to another household.",
    targetAlreadyInThisFamily: "That person is already in this household.",
    cannotLinkSelf:
      "Choose a different client — you can't link someone to themselves.",
    contactRequired: "Add an email or phone number so we can reach them.",
    displayNameRequired: "Enter the client's name.",
    alreadyInactive: "This client is already deactivated.",
    alreadyApproved: "This client is already approved.",
    conflict: "Someone else updated this client. Refresh, then try again.",
    invalidId: "That client link isn't valid.",
    invalidTier: "Choose a valid guest tier.",
    tierNotConfigured:
      "Guest tiers aren't set up yet. Ask an admin to configure them.",
    pickHousehold: "Pick a household to join.",
    pickClientToAdd: "Pick a client to add to this household.",
    pickRelatedPerson: "Pick a related person to link.",
  },
} as const;
