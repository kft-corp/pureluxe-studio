import type { IconType } from "react-icons";
import {
  LuActivity,
  LuAlarmClock,
  LuBadgeCheck,
  LuBan,
  LuBedDouble,
  LuBriefcase,
  LuBus,
  LuCalendarDays,
  LuCircleDollarSign,
  LuClipboardList,
  LuCoins,
  LuCompass,
  LuEye,
  LuFileCheck,
  LuFingerprint,
  LuGitCompare,
  LuHistory,
  LuHotel,
  LuImport,
  LuLogIn,
  LuLogOut,
  LuMapPin,
  LuMapPinned,
  LuMessageSquare,
  LuNetwork,
  LuNotebookPen,
  LuPenLine,
  LuPercent,
  LuPlane,
  LuPlaneLanding,
  LuPlaneTakeoff,
  LuReceipt,
  LuRoute,
  LuScrollText,
  LuSparkles,
  LuStore,
  LuTicket,
  LuUser,
  LuUserCheck,
  LuUserPen,
  LuUsers,
  LuWallet,
} from "react-icons/lu";

import type { ServiceTimingIconKey } from "@/lib/bookings";

const SERVICE_ICONS: Record<string, IconType> = {
  hotel: LuHotel,
  flight: LuPlane,
  transfer: LuBus,
  activity: LuCompass,
};

export function bookingServiceIcon(serviceType: string): IconType {
  return SERVICE_ICONS[serviceType] ?? LuClipboardList;
}

/** DetailField / glance icons keyed by meaning. */
export const bookingDetailIcons = {
  property: LuHotel,
  location: LuMapPin,
  chain: LuNetwork,
  travelDates: LuCalendarDays,
  rooms: LuBedDouble,
  partySize: LuUsers,
  serviceDetails: LuClipboardList,
  client: LuUser,
  trip: LuRoute,
  accountOwner: LuUserCheck,
  bookedBy: LuUserPen,
  sourceTripBuilder: LuSparkles,
  sourceManual: LuPenLine,
  sourceImport: LuImport,
  sourceClientApp: LuEye,
  bookingId: LuFingerprint,
  supplier: LuStore,
  confirmationRef: LuTicket,
  bookingChannel: LuBriefcase,
  sellPrice: LuCircleDollarSign,
  supplierCost: LuWallet,
  commission: LuPercent,
  currency: LuCoins,
  status: LuActivity,
  confirmedAt: LuBadgeCheck,
  cancelledAt: LuBan,
  cancellationReason: LuMessageSquare,
  cancellationDeadline: LuAlarmClock,
  ticketTimeLimit: LuTicket,
  cancellationPolicy: LuScrollText,
  confirmationFile: LuFileCheck,
  amendedFrom: LuGitCompare,
  checkIn: LuLogIn,
  checkOut: LuLogOut,
  supplierRef: LuTicket,
  depart: LuPlaneTakeoff,
  arrive: LuPlaneLanding,
  pickup: LuMapPinned,
  dropoff: LuMapPin,
  travellers: LuUsers,
  commercial: LuReceipt,
  policy: LuAlarmClock,
  notes: LuNotebookPen,
  activity: LuHistory,
} as const satisfies Record<string, IconType>;

export function serviceTimingIcon(
  key: ServiceTimingIconKey,
  serviceType: string,
): IconType {
  if (key === "ref") return bookingDetailIcons.supplierRef;
  if (key === "pickup") return bookingDetailIcons.pickup;
  if (key === "dropoff") return bookingDetailIcons.dropoff;
  if (serviceType === "flight") {
    return key === "start"
      ? bookingDetailIcons.depart
      : bookingDetailIcons.arrive;
  }
  if (serviceType === "transfer") {
    return key === "start"
      ? bookingDetailIcons.pickup
      : bookingDetailIcons.dropoff;
  }
  return key === "start"
    ? bookingDetailIcons.checkIn
    : bookingDetailIcons.checkOut;
}

export function bookingSourceIcon(source: string): IconType {
  switch (source) {
    case "trip_builder":
      return bookingDetailIcons.sourceTripBuilder;
    case "manual":
      return bookingDetailIcons.sourceManual;
    case "import":
      return bookingDetailIcons.sourceImport;
    case "client_app":
      return bookingDetailIcons.sourceClientApp;
    default:
      return bookingDetailIcons.sourceManual;
  }
}
