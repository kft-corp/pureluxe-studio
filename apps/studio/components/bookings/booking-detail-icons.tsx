import type { IconType } from "react-icons";
import {
  LuBadgeCheck,
  LuBan,
  LuBanknote,
  LuBedDouble,
  LuBriefcase,
  LuBuilding2,
  LuCalendarClock,
  LuCalendarDays,
  LuCarFront,
  LuCircleDot,
  LuClipboardList,
  LuCoins,
  LuCompass,
  LuDoorClosed,
  LuDoorOpen,
  LuFileCheck,
  LuFilePen,
  LuHandshake,
  LuHash,
  LuHistory,
  LuHotel,
  LuImport,
  LuMapPin,
  LuMapPinned,
  LuMessageSquare,
  LuNotebookPen,
  LuPenLine,
  LuPercent,
  LuPlane,
  LuPlaneLanding,
  LuPlaneTakeoff,
  LuReceipt,
  LuRoute,
  LuScrollText,
  LuShieldAlert,
  LuSmartphone,
  LuSparkles,
  LuTimer,
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
  transfer: LuCarFront,
  activity: LuCompass,
};

export function bookingServiceIcon(serviceType: string): IconType {
  return SERVICE_ICONS[serviceType] ?? LuClipboardList;
}

/** DetailField / glance icons keyed by meaning. */
export const bookingDetailIcons = {
  property: LuHotel,
  location: LuMapPin,
  chain: LuBuilding2,
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
  sourceClientApp: LuSmartphone,
  bookingId: LuHash,
  supplier: LuHandshake,
  confirmationRef: LuHash,
  bookingChannel: LuBriefcase,
  sellPrice: LuBanknote,
  supplierCost: LuWallet,
  commission: LuPercent,
  currency: LuCoins,
  status: LuCircleDot,
  confirmedAt: LuBadgeCheck,
  cancelledAt: LuBan,
  cancellationReason: LuMessageSquare,
  cancellationDeadline: LuCalendarClock,
  ticketTimeLimit: LuTimer,
  cancellationPolicy: LuScrollText,
  confirmationFile: LuFileCheck,
  amendedFrom: LuFilePen,
  checkIn: LuDoorOpen,
  checkOut: LuDoorClosed,
  supplierRef: LuHash,
  depart: LuPlaneTakeoff,
  arrive: LuPlaneLanding,
  pickup: LuMapPinned,
  dropoff: LuMapPin,
  travellers: LuUsers,
  commercial: LuReceipt,
  policy: LuShieldAlert,
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
