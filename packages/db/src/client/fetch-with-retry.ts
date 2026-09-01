import { isPgrst303Error } from "./pgrst303";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

/** Retry transient PostgREST clock-drift errors with new sb_secret_ keys. */
export async function fetchWithPgrst303Retry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(input, init);
    lastResponse = response;

    if (response.status !== 401 || attempt === MAX_ATTEMPTS) {
      return response;
    }

    try {
      const body: unknown = await response.clone().json();
      if (!isPgrst303Error(body)) {
        return response;
      }
    } catch {
      return response;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
  }

  return lastResponse!;
}
