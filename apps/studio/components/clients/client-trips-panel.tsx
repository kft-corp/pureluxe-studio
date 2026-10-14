"use client";

import { ContentSection } from "@/components/ui";

import { SnapshotCard } from "./client-profile-hero-widgets";
import type { ProfileClient } from "./client-profile-shared";

export function ClientTripsPanel({ client }: { client: ProfileClient }) {
  return (
    <ContentSection
      title="Trips & spend"
      description="Stay history and spend will appear here once Bookings is connected."
    >
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3 sm:px-6">
        <SnapshotCard
          label="Lifetime spend"
          value="$0"
          hint="Coming soon"
        />
        <SnapshotCard
          label="Stays"
          value={String(client.stats.booking_count)}
          hint="Coming soon"
        />
        <SnapshotCard
          label="Open trips"
          value={String(client.stats.open_trip_count)}
          hint="Coming soon"
        />
      </div>
    </ContentSection>
  );
}
