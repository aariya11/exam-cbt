import { prisma } from "./db";

type PrismaLike = {
  auditLog: {
    create: (args: {
      data: {
        actorId?: string | null;
        action: string;
        entityType: string;
        entityId?: string | null;
        before?: string | null;
        after?: string | null;
        ip?: string | null;
      };
    }) => Promise<unknown>;
  };
};

type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

const serialize = (value: unknown): string | null =>
  value === undefined ? null : JSON.stringify(value, null, 0);

// Write an audit record. Accepts a transaction client so that audit entries
// commit atomically with the change they describe.
export async function writeAudit(input: AuditInput, client: PrismaLike = prisma): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: serialize(input.before),
      after: serialize(input.after),
      ip: input.ip ?? null,
    },
  });
}
