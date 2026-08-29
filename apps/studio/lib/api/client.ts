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

// Fetch and parse { success, data } / { success: false, error }.
export async function fetchApi<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApiSuccessResponse<T>> {
  const response = await fetch(input, init);
  const body: unknown = await response.json();

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
