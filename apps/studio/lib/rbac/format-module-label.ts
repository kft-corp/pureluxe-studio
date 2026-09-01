/** Human-readable label from a permission module key. */
const MODULE_LABELS: Record<string, string> = {
  home: "Home",
  trip_builder: "Trip Builder",
  bookings: "Bookings",
  clients: "Clients",
  trips: "Trips",
  trainer: "Trainer",
  tasks: "Tasks",
  commissions: "Commissions",
  payments: "Payments",
  team: "Team & Roles",
  settings: "Settings",
};

export function formatModuleLabel(module: string): string {
  const normalized = module.trim().toLowerCase();
  return (
    MODULE_LABELS[normalized] ??
    normalized
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}
