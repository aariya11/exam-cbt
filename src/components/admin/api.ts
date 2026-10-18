// Small fetch helper for admin client components. The API returns success
// bodies directly and errors as { error: { code, message } }.

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && body.error && typeof body.error.message === "string"
        ? body.error.message
        : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export type Meta = {
  categories: Array<{ id: string; name: string; slug: string }>;
  subjects: Array<{ id: string; name: string; slug: string; topics: Array<{ id: string; name: string }> }>;
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
