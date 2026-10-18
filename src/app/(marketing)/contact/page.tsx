import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { Mail, ShieldCheck, Timer } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the RankForge team about technical issues, content corrections, data requests or partnerships.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Contact us</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500 dark:text-ink-400">
          Found a wrong answer key, hit a bug mid-test, or want to talk about institution access? Tell us what happened
          with as much detail as you can - question IDs and test names help us act fast.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Send a message" description="Delivered directly to our support queue" />
          <CardBody>
            <ContactForm />
          </CardBody>
        </Card>

        <div className="space-y-4">
          {[
            {
              icon: Timer,
              title: "Response time",
              body: "We aim to respond within two working days. Content corrections (reported with a question reference) are prioritised.",
            },
            {
              icon: ShieldCheck,
              title: "Data requests",
              body: "For account deletion or data access requests, use this form with the subject 'Privacy request' from your registered email address.",
            },
            {
              icon: Mail,
              title: "Email",
              body: "Prefer email? Write to the address published in the footer of any notification you receive from us.",
            },
          ].map((item) => (
            <div key={item.title} className="card-surface px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <h2 className="text-sm font-semibold text-ink-950 dark:text-ink-50">{item.title}</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-500 dark:text-ink-400">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
