import { NextResponse } from "next/server";
import type { ApiResponse } from "./experience-api-types";

export function experienceJson<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function experienceCreated<T>(data: T): NextResponse<ApiResponse<T>> {
  return experienceJson(data, 201);
}

export function experienceError(
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
