import { cookies } from "next/headers";

import { getStudioSession } from "@pureluxe/auth";

/** Studio session for server components and route handlers. */
export async function loadStudioSession() {
  return getStudioSession(await cookies());
}
