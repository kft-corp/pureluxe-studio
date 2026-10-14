import {
  isApiErrorResponse,
  isApiSuccessResponse,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from "@pureluxe/shared";

// API returned success: false.
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(body: ApiErrorResponse, status: number) {
    super(body.error.message);
    this.name = "ApiRequestError";
    this.code = body.error.code;
    this.status = status;
  }
}

function apiBodyWasNotJson(response: Response): Error {
  if (response.status === 401 || response.url.includes("/login")) {
    return new Error("Your session expired. Please sign in again.");
  }

  if (response.status === 404) {
    return new Error(
      "The server could not find that request. Refresh the page and try again.",
    );
  }

  return new Error(
    "The server returned an unexpected response. Refresh the page and try again.",
  );
}

// Fetch and parse { success, data } / { success: false, error }.
export async function fetchApi<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApiSuccessResponse<T>> {
  const response = await fetch(input, init);
  const raw = await response.text();
  let body: unknown;

  try {
    body = raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    throw apiBodyWasNotJson(response);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    isApiSuccessResponse(body as ApiSuccessResponse<T>)
  ) {
    return body as ApiSuccessResponse<T>;
  }

  if (
    typeof body === "object" &&
    body !== null &&
    isApiErrorResponse(body as ApiErrorResponse)
  ) {
    throw new ApiRequestError(body as ApiErrorResponse, response.status);
  }

  throw new Error("Unexpected API response shape.");
}
