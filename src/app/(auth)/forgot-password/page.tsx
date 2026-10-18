import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a password reset link for your RankForge account.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="card-surface p-6 sm:p-8">
      <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Reset your password</h1>
      <p className="mt-1.5 mb-6 text-sm text-ink-500 dark:text-ink-400">
        Enter your registered email address and we will send you a link to set a new password.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
