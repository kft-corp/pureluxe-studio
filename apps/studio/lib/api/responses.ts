import {
  AppError,
  toAppError,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from "@pureluxe/shared";
import { NextResponse } from "next/server";

type ApiSuccessOptions = {
  message?: string;
  status?: number;
};

/** JSON success envelope — HTTP status on the response, not in the body. */
export function apiSuccess<T>(
  data: T,
  options?: ApiSuccessOptions,
): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  if (options?.message) {
    body.message = options.message;
  }

  return NextResponse.json(body, { status: options?.status ?? 200 });
}

/** JSON error envelope from a typed AppError. */
export function apiError(error: AppError): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.userMessage,
      },
    },
    { status: error.status },
  );
}

/** Map unknown throws to the standard error envelope. */
export function apiFromError(cause: unknown): NextResponse<ApiErrorResponse> {
  return apiError(toAppError(cause));
}
