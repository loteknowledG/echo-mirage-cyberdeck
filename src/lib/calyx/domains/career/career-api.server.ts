import { NextResponse } from "next/server";
import type { ApiResponse } from "./career-api-types";

export function careerJson<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function careerCreated<T>(data: T): NextResponse<ApiResponse<T>> {
  return careerJson(data, 201);
}

export function careerError(
  code: string,
  message: string,
  status: number,
  details?: string[],
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}
