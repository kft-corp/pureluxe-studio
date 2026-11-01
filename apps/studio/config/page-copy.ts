/** Page titles and descriptions shared by each route and its loading skeleton. */
export const pageCopy = {
  home: {
    title: "Home",
    description: "Your starting point for trips, check-ins, and deadlines.",
  },
  clients: {
    title: "Clients",
    description: "Your guests — open a profile to plan their next stay.",
  },
  client: {
    title: "Client profile",
    description:
      "Preferences, household, and trips — ready for the next destination.",
  },
  bookings: {
    title: "Bookings",
    description: "Confirmed inventory — refs, deadlines, and follow-ups.",
  },
  trips: {
    title: "Trips",
    description:
      "Who is travelling, when, and whether the trip is still being planned.",
  },
  trip: {
    title: "Trip",
    description: "The journey in travel order. Change the plan in Trip Builder.",
  },
  tripBuilder: {
    title: "Trip Builder",
    description: "Chat desk for hotel quotes — client, stay, rates, sell, quote.",
  },
  team: {
    title: "Team & Roles",
    description:
      "Invite teammates, manage access, and set what each role can do.",
  },
  account: {
    title: "Account",
    description:
      "View and update your profile, role, and team account details.",
  },
} as const;

/** Sidebar chrome — travel desk actions and cues. */
export const sidebarCopy = {
  newTrip: "New trip",
  recent: "Recent",
} as const;

/** Directory list section headings (unfiltered state). */
export const listSectionCopy = {
  clients: {
    title: "Traveller book",
    description: "Who you advise — open a guest to shape their next journey.",
  },
  bookings: {
    title: "Booking list",
    description:
      "Confirmed stays and flights — check refs, deadlines, and what needs follow-up.",
  },
  trips: {
    title: "Trip list",
    description:
      "Who is travelling, when, and whether the trip is still being planned.",
  },
} as const;
