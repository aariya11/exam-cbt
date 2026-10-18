import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The rules for using RankForge mock tests, accounts and leaderboards.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="19 October 2026"
      intro="These terms govern your use of RankForge. By creating an account or attempting any mock test you agree to them. Plain language is intentional."
    >
      <h2>1. The service</h2>
      <p>
        RankForge provides timed practice mock tests, scoring, performance analytics and practice rankings for
        competitive examination preparation. The service is provided as-is; we work hard to keep it accurate and
        available, but we do not promise uninterrupted availability.
      </p>

      <h2>2. Independence</h2>
      <p>
        RankForge is not affiliated with, endorsed by, or connected to any examination authority, recruitment board or
        government body. All questions are original practice content. Ranks shown are practice ranks among RankForge
        participants and are not official examination results.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You must provide accurate registration details and keep your password confidential.</li>
        <li>You are responsible for activity under your account. If you suspect compromise, reset your password immediately - this revokes all sessions.</li>
        <li>One person per account. Accounts may not be shared, sold or transferred.</li>
      </ul>

      <h2>4. Fair use of tests</h2>
      <ul>
        <li>Attempts are personal practice. You may not use automated tools to answer questions, extract content, or interfere with the platform.</li>
        <li>During a test, RankForge records technical integrity signals (for example, resuming the same attempt on a second device, or repeatedly leaving the test window). Repeated anomalies may invalidate an attempt after review.</li>
        <li>Attempts that are invalidated for integrity reasons do not appear on leaderboards.</li>
      </ul>

      <h2>5. Content and intellectual property</h2>
      <p>
        Questions, solutions, explanations and platform code are owned by RankForge or its licensors. You may use them
        for personal study. You may not republish, resell or systematically extract content, or use it to train
        commercial models, without written permission.
      </p>

      <h2>6. Results and ranks</h2>
      <p>
        Scoring follows the marking scheme published on each test. Ranking follows the policy published on the
        leaderboard pages. If you believe a result is wrong (for example, a defective question), report it with the
        attempt and question reference; verified defects are corrected through a controlled regrading process and
        affected results and ranks are recalculated.
      </p>

      <h2>7. Acceptable conduct</h2>
      <ul>
        <li>No harassment of other users; display names must be respectful.</li>
        <li>No attempts to probe, scan or breach the platform&apos;s security or other users&apos; accounts.</li>
        <li>No scraping, bulk downloading or denial-of-service behaviour.</li>
      </ul>

      <h2>8. Suspension and termination</h2>
      <p>
        We may suspend or terminate accounts that breach these terms, attempt to manipulate rankings or misuse the
        platform. You may delete your account at any time from your profile page.
      </p>

      <h2>9. Fees</h2>
      <p>
        RankForge is free during its preview period. If paid plans are introduced, prices and terms will be shown
        clearly before any payment is requested, and this section will be updated.
      </p>

      <h2>10. Liability</h2>
      <p>
        To the maximum extent permitted by law, RankForge is not liable for indirect or consequential losses arising
        from use of the platform, including decisions made based on practice scores or ranks. Nothing in these terms
        limits liability that cannot be limited by law.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        Material changes will be notified to account holders before they take effect. Continued use after the effective
        date constitutes acceptance.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of India, and disputes are subject to the exclusive jurisdiction of the
        courts at the operator&apos;s registered location in India.
      </p>
    </LegalPage>
  );
}
