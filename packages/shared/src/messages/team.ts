/** Team & roles management copy. */
export const teamMessages = {
  success: {
    inviteSent: "Invite sent. They can sign in with Google once they accept.",
    inviteResent: "Invite refreshed. They can sign in with Google when ready.",
    inviteRevoked: "Invite revoked.",
    roleUpdated: "Role updated.",
    memberDeactivated: "Member deactivated.",
    memberReactivated: "Member reactivated.",
  },
  error: {
    memberNotFound: "We couldn't find that team member.",
    inviteNotFound: "We couldn't find that invite.",
    emailAlreadyMember: "That email already belongs to a team member.",
    emailAlreadyInvited: "A pending invite already exists for that email.",
    cannotDeactivateSelf: "You can't deactivate your own account.",
    cannotChangeOwnRole: "You can't change your own role.",
    manageRequired: "You don't have permission to manage team members.",
  },
} as const;
