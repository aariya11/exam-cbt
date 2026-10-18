import { assertSameOrigin, getClientIp, handle, ok, readJson } from "@/lib/api";
import { contactSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import { writeAudit } from "@/lib/audit";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const ip = getClientIp(req);
  enforceRateLimit(`contact:${ip ?? "unknown"}`, 5, 60 * 60 * 1000);

  const input = await readJson(req, contactSchema);
  const to = process.env.CONTACT_EMAIL || "support@rankforge.local";

  await sendMail({
    to,
    subject: `[RankForge contact] ${input.subject}`,
    text: `From: ${input.name} <${input.email}>\n\n${input.message}`,
  });

  await writeAudit({
    action: "contact.message_received",
    entityType: "ContactMessage",
    after: { email: input.email, subject: input.subject },
    ip,
  });

  return ok({
    submitted: true,
    message: "Thank you. Your message has been recorded and our team will respond within two working days.",
  });
});
