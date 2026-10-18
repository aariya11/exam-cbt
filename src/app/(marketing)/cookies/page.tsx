import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "The cookies and local storage RankForge uses, and why.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie policy"
      updated="19 October 2026"
      intro="RankForge keeps its cookie usage minimal: one essential cookie to keep you signed in, and one local preference for your theme. There are no advertising or cross-site tracking cookies on this site."
    >
      <h2>Cookies we set</h2>
      <ul>
        <li>
          <strong>rf_session</strong> - an httpOnly session cookie that references your server-side session record. It
          is required for signing in and for taking tests. Typical lifetime: 30 days, refreshed as you use the site;
          deleted when you sign out.
        </li>
      </ul>

      <h2>Local storage we use</h2>
      <ul>
        <li>
          <strong>rf-theme</strong> - remembers whether you prefer the light or dark theme so the site does not flash
          the wrong colours. Stored in your browser only.
        </li>
      </ul>

      <h2>What we do not use</h2>
      <ul>
        <li>No advertising cookies or pixels.</li>
        <li>No third-party analytics or social media trackers.</li>
        <li>No cross-site tracking of any kind.</li>
      </ul>

      <h2>Managing cookies</h2>
      <p>
        You can delete or block cookies in your browser settings. Blocking the session cookie will prevent you from
        signing in and from taking tests; everything else on the site continues to work.
      </p>
    </LegalPage>
  );
}
