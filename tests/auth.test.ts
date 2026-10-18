import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, verifyPassword } from "@/lib/auth-core";

describe("password hashing", () => {
  it("verifies a correct password against its stored hash", async () => {
    const hash = await hashPassword("Correct-Horse-1");
    await expect(verifyPassword("Correct-Horse-1", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Correct-Horse-1");
    await expect(verifyPassword("correct-horse-1", hash)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("produces a fresh salt for every hash of the same password", async () => {
    const first = await hashPassword("Same-Password-1");
    const second = await hashPassword("Same-Password-1");
    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt:")).toBe(true);
  });

  it("rejects malformed stored hashes", async () => {
    await expect(verifyPassword("anything", "garbage")).resolves.toBe(false);
    await expect(verifyPassword("anything", "scrypt:1:2")).resolves.toBe(false);
    await expect(verifyPassword("anything", "bcrypt:32768:8:1:00:00")).resolves.toBe(false);
  });
});

describe("token hashing", () => {
  it("is deterministic and never returns the raw token", () => {
    const token = "raw-token-value";
    const hash = hashToken(token);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different tokens", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });
});
