import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "RankForge accessibility statement: what we support today and how to report barriers.",
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      title="Accessibility statement"
      updated="19 October 2026"
      intro="RankForge should be usable by every aspirant, including those who rely on keyboards, screen readers, magnification or reduced motion. This statement describes where we stand today."
    >
      <h2>What we support today</h2>
      <ul>
        <li>Full keyboard operation: every control, including the question palette and dialogs, is reachable and operable with a keyboard.</li>
        <li>Visible focus indicators on all interactive elements, with a skip-to-content link on every page.</li>
        <li>Semantic structure: landmarks, headings, form labels, table headers and status announcements for assistive technology.</li>
        <li>Colour contrast designed against WCAG AA for text and essential interface elements, in both light and dark themes.</li>
        <li>Reduced-motion support: users who prefer reduced motion get transitions and animations suppressed.</li>
        <li>Charts include screen-reader accessible data tables so no information is conveyed by colour alone.</li>
        <li>Responsive layout down to small phone screens, with touch targets sized for fingers.</li>
      </ul>

      <h2>Known limitations</h2>
      <ul>
        <li>Rich-text mathematical expressions render with KaTeX, which exposes MathML/HTML accessible markup, but some screen-reader and browser combinations announce expressions imperfectly.</li>
        <li>Timed tests are inherently time-bound; RankForge does not yet offer per-account time extensions. If you need an accommodation, contact us before your attempt and we will arrange it manually.</li>
      </ul>

      <h2>Reporting a barrier</h2>
      <p>
        If something blocks you, tell us through the contact form with the page address and the assistive technology
        you use. Accessibility reports are treated as priority defects.
      </p>
    </LegalPage>
  );
}
