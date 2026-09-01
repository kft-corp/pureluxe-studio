import { apiRoutes } from "@/lib/routes";

import { fetchApi } from "./client";

export type AccountProfileData = {
  memberId: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  phone: string | null;
};

/** Load the signed-in member profile from the database. */
export function getAccountProfile() {
  return fetchApi<AccountProfileData>(apiRoutes.account.me, {
    cache: "no-store",
  });
}
