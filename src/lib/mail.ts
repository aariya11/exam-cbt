// Transactional email integration boundary.
//
// RankForge does not bundle a mail provider dependency. Without SMTP_URL
// configured, messages are logged to the server console so development flows
// (verification links, password resets) remain fully testable. In production,
// set SMTP_URL and implement delivery here (or swap in a provider SDK). The
// function signature is the contract the rest of the app relies on.

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type MailResult = { delivered: boolean; transport: "console" | "smtp" };

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const smtpUrl = process.env.SMTP_URL;
  if (!smtpUrl) {
    // Development / unconfigured environment: log instead of sending.
    console.info(
      `[mail:console] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
    return { delivered: false, transport: "console" };
  }

  // SMTP is configured but no transport implementation is bundled. Fail loudly
  // rather than pretending the email was sent.
  throw new Error(
    "SMTP_URL is set but no SMTP transport is implemented. " +
      "Add a mail provider integration in src/lib/mail.ts before enabling SMTP in production.",
  );
}

export function appUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export function buildVerificationEmail(to: string, token: string, displayName: string): MailMessage {
  const url = `${appUrl()}/verify-email?token=${token}`;
  return {
    to,
    subject: "Verify your RankForge email address",
    text: `Hi ${displayName},\n\nWelcome to RankForge. Confirm your email address to unlock mock tests and rankings:\n${url}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
  };
}

export function buildPasswordResetEmail(to: string, token: string, displayName: string): MailMessage {
  const url = `${appUrl()}/reset-password?token=${token}`;
  return {
    to,
    subject: "Reset your RankForge password",
    text: `Hi ${displayName},\n\nWe received a request to reset your RankForge password. Use the link below within 30 minutes:\n${url}\n\nIf you did not request this, no action is needed and your password remains unchanged.`,
  };
}
