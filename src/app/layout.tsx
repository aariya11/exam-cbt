import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const appUrl = process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "RankForge — Prepare. Compete. Prove Yourself.",
    template: "%s · RankForge",
  },
  description:
    "RankForge is a timed computer-based mock test platform for national competitive examinations in India: realistic CBT practice, instant scoring, performance analytics and practice rankings.",
  applicationName: "RankForge",
  keywords: ["mock test", "CBT practice", "NEET", "JEE Main", "SSC", "banking", "railway", "CUET"],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    siteName: "RankForge",
    title: "RankForge — Prepare. Compete. Prove Yourself.",
    description:
      "Realistic timed mock tests, instant scorecards, analytics and practice leaderboards for national competitive examinations.",
    url: appUrl,
  },
  twitter: {
    card: "summary",
    title: "RankForge — Prepare. Compete. Prove Yourself.",
    description: "Timed CBT mock tests with instant scoring and practice rankings.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8FC" },
    { media: "(prefers-color-scheme: dark)", color: "#101828" },
  ],
};

// Applied before first paint to avoid a light-mode flash for dark-mode users.
const themeInit = `(function(){try{var t=localStorage.getItem("rf-theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
