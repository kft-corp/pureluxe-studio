/** Page titles and descriptions shared by each route and its loading skeleton. */
export const pageCopy = {
  home: {
    title: "Home",
    description: "Your starting point for trips, check-ins, and deadlines.",
  },
  clients: {
    title: "Clients",
    description: "Find people fast, filter the book, and open a profile.",
  },
  client: {
    title: "Client profile",
    description:
      "Everything your team needs to know about this guest before the next trip.",
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

/** Directory list section headings (unfiltered state). */
export const listSectionCopy = {
  clients: {
    title: "Client list",
    description: "Pick someone to open their profile and prep the next trip.",
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
