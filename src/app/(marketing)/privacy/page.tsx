import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How RankForge collects, uses, stores and deletes personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="19 October 2026"
      intro="This policy explains what personal data RankForge collects, why we collect it, how long we keep it and what control you have over it. It is written to be read, not to hide behind."
    >
      <h2>1. Who we are</h2>
      <p>
        RankForge operates an independent practice platform for competitive examination aspirants. For privacy matters,
        contact us through the contact form with the subject &quot;Privacy request&quot;.
      </p>

      <h2>2. What we collect</h2>
      <h3>Account data</h3>
      <ul>
        <li>Your name, username, email address and password (stored only as a salted scrypt hash - never in plain text).</li>
        <li>Optional profile fields you choose to add, such as state and city, which power state-wise leaderboard filters.</li>
        <li>Consent records: which policies you accepted and when.</li>
      </ul>
      <h3>Attempt data</h3>
      <ul>
        <li>Your answers, question timings and attempt events (start, saves, resumption, submission, focus-loss signals during a live test).</li>
        <li>A one-way hash of your IP address on attempts (used only for integrity review; the raw IP is not stored on the attempt).</li>
        <li>Browser user-agent summary for session security.</li>
      </ul>
      <h3>What we do not collect</h3>
      <ul>
        <li>No camera or microphone access is requested or used.</li>
        <li>No third-party advertising or analytics trackers run on this site.</li>
        <li>No payment details - RankForge is free during preview and collects no card data.</li>
      </ul>

      <h2>3. Why we process it</h2>
      <ul>
        <li>To provide the service: run your tests, score your papers, show your analytics and ranks.</li>
        <li>To keep the platform fair: detect concurrent sessions, enforce deadlines and maintain an audit trail.</li>
        <li>To keep you informed: transactional email only (verification, password reset). No marketing email without consent.</li>
        <li>To answer you: contact messages you send us.</li>
      </ul>

      <h2>4. Leaderboards and visibility</h2>
      <p>
        When your result is published and you appear on a leaderboard, your display name, username, state (if you
        provided one) and score are visible to other signed-in users. If you prefer not to appear, you can hide your
        profile from public leaderboards from your profile settings; historical leaderboards pause for you
        immediately.
      </p>

      <h2>5. Retention</h2>
      <ul>
        <li>Account data: kept while your account exists.</li>
        <li>Attempt and result data: kept while your account exists so analytics and rankings remain consistent.</li>
        <li>Security logs and audit records: retained for up to 12 months after the event for abuse investigation.</li>
        <li>Expired sessions and one-time tokens: purged automatically.</li>
      </ul>

      <h2>6. Your rights</h2>
      <ul>
        <li>Access: request a copy of your personal data.</li>
        <li>Correction: edit your profile details at any time.</li>
        <li>Deletion: delete your account from your profile page. Deletion removes your personal data; aggregate, de-identified statistics may remain.</li>
        <li>Objection: contact us about any processing you are uncomfortable with; we will explain or stop it.</li>
      </ul>

      <h2>7. Cookies</h2>
      <p>
        We use a single essential session cookie to keep you signed in. We also store one local preference for your
        theme choice. We do not use advertising or cross-site tracking cookies. See the cookie policy for details.
      </p>

      <h2>8. Security</h2>
      <p>
        Passwords use salted scrypt hashing. Sessions are server-side records referenced by an httpOnly cookie and can
        be revoked at any time (for example, when a password is reset). Sensitive administrative actions are written to
        an audit log. No system is perfect, but we design so that a breach of one layer does not hand over plain-text
        credentials or unbounded access.
      </p>

      <h2>9. Children</h2>
      <p>
        RankForge is not directed at children under 13. If you believe a child has created an account, contact us and we
        will remove it.
      </p>

      <h2>10. Changes</h2>
      <p>
        If we make a material change to this policy we will notify account holders by email before it takes effect and
        update the date at the top of this page.
      </p>
    </LegalPage>
  );
}
