import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, badRequest, forbidden } from "./errors";
import { SESSION_COOKIE, getAuthFromToken, type AuthContext } from "./auth-core";
import { isAtLeastRole, type Role } from "./constants";

export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse {
  const body: ApiError = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return NextResponse.json(body, { status });
}

export function fromError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return fail(error.status, error.code, error.message, error.details);
  }
  if (error instanceof ZodError) {
    return fail(400, "VALIDATION_ERROR", "The request payload is invalid.", error.issues);
  }
  console.error("[api] unhandled error", error);
  return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

// Wrap a route handler so all errors map to safe JSON responses.
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return fromError(error);
    }
  };
}

// CSRF defense in depth. Session cookies are SameSite=Lax (primary CSRF
// protection); this additionally rejects browser requests whose Origin does not
// match the application origin. Non-browser clients without an Origin header
// are not subject to CSRF.
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  if (!host) throw forbidden("Missing host header.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Invalid origin.");
  }
  if (originHost !== host) {
    throw forbidden("Cross-origin request rejected.");
  }
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(payload);
}

export async function requireAuth(req: Request): Promise<AuthContext> {
  const token = readSessionToken(req);
  if (!token) throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  const ctx = await getAuthFromToken(token);
  if (!ctx) throw new AppError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
  return ctx;
}

export async function requireRole(req: Request, min: Role): Promise<AuthContext> {
  const ctx = await requireAuth(req);
  if (!isAtLeastRole(ctx.user.role, min)) throw forbidden();
  return ctx;
}

export function readSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
    }
  }
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export function parsePagination(url: URL, defaultSize = 20): { page: number; pageSize: number } {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const rawSize = Number(url.searchParams.get("pageSize") ?? String(defaultSize)) || defaultSize;
  const pageSize = Math.min(50, Math.max(1, rawSize));
  return { page, pageSize };
}
