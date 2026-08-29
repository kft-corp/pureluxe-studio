/** Stable machine code + user-safe message (HTTP status lives on the response). */
export type ApiErrorBody = {
  code: string;
  message: string;
};

export type ApiErrorResponse = {
  success: false;
  error: ApiErrorBody;
};

export type ApiSuccessResponse<T = unknown> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiResponse<T = unknown> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse;

export function isApiSuccessResponse<T>(
  body: ApiResponse<T>,
): body is ApiSuccessResponse<T> {
  return body.success;
}

export function isApiErrorResponse(body: ApiResponse): body is ApiErrorResponse {
  return !body.success;
}
