// Test environment defaults. The integration suite runs against a dedicated
// SQLite database (prisma/test.db) that is rebuilt by the test itself; unit
// tests never touch a database.
process.env.DATABASE_URL ??= "file:./test.db";
process.env.SESSION_PEPPER ??= "vitest-pepper-0123456789abcdef0123456789abcdef";
process.env.DEADLINE_GRACE_SECONDS ??= "2";
