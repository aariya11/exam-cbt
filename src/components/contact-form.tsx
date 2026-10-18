"use client";

import { useState } from "react";
import { Alert, Button, FieldError, Input, Label, Textarea } from "@/components/ui";

type Errors = { name?: string; email?: string; subject?: string; message?: string };

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    setErrors({});

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      subject: String(form.get("subject") ?? ""),
      message: String(form.get("message") ?? ""),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        message?: string;
        error?: { message: string; fields?: Record<string, string[]> };
      };
      if (!response.ok) {
        if (body.error?.fields) {
          const next: Errors = {};
          for (const [key, messages] of Object.entries(body.error.fields)) {
            if (messages[0]) next[key as keyof Errors] = messages[0];
          }
          setErrors(next);
        }
        setError(body.error?.message ?? "We could not record your message. Please try again.");
        return;
      }
      setDone(body.message ?? "Thank you - your message has been recorded.");
      event.currentTarget.reset();
    } catch {
      setError("Network problem - please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {done ? <Alert tone="success">{done}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-name">Your name</Label>
          <Input id="contact-name" name="name" autoComplete="name" required maxLength={120} />
          <FieldError>{errors.name}</FieldError>
        </div>
        <div>
          <Label htmlFor="contact-email">Email address</Label>
          <Input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <FieldError>{errors.email}</FieldError>
        </div>
      </div>
      <div>
        <Label htmlFor="contact-subject">Subject</Label>
        <Input id="contact-subject" name="subject" required maxLength={160} />
        <FieldError>{errors.subject}</FieldError>
      </div>
      <div>
        <Label htmlFor="contact-message">Message</Label>
        <Textarea id="contact-message" name="message" required rows={6} maxLength={4000} />
        <FieldError>{errors.message}</FieldError>
      </div>
      <Button type="submit" loading={busy} size="lg">
        Send message
      </Button>
      <p className="text-xs leading-5 text-ink-400 dark:text-ink-500">
        We use your details only to respond to this enquiry. See the privacy policy for how contact messages are handled.
      </p>
    </form>
  );
}
