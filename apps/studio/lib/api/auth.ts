import { apiRoutes } from "@/lib/routes";

import { fetchApi } from "./client";

export function logout() {
  return fetchApi<null>(apiRoutes.auth.logout, { method: "POST" });
}
