"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Tabs } from "@/components/Tabs";
import { EmailTable } from "@/components/EmailTable";
import { ComposeModal } from "@/components/ComposeModal";
import { Button } from "@/components/Button";
import { fetchScheduledEmails, fetchSentEmails } from "@/lib/api";
import type { ScheduledEmail, SentEmail } from "@/types/email";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");
  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scheduledEmails, sentEmails] = await Promise.all([
        fetchScheduledEmails(),
        fetchSentEmails(),
      ]);
      setScheduled(scheduledEmails);
      setSent(sentEmails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "loading") return;
    const timeout = setTimeout(() => {
      router.replace("/login");
    }, 8000);
    return () => clearTimeout(timeout);
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      loadEmails();
    }
  }, [status, loadEmails]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const interval = setInterval(loadEmails, 10000);
    return () => clearInterval(interval);
  }, [status, loadEmails]);

  const scheduledRows = scheduled.map((email) => ({
    email: email.recipientEmail,
    subject: email.subject,
    scheduledTime: formatDate(email.scheduledAt),
    status: email.status,
  }));

  const sentRows = sent.map((email) => ({
    email: email.recipientEmail,
    subject: email.subject,
    sentTime: formatDate(email.sentAt),
    status: email.status,
    details: email.errorMessage ?? "—",
  }));

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs activeTab={activeTab} onChange={setActiveTab} />
          <Button onClick={() => setComposeOpen(true)}>Compose New Email</Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {activeTab === "scheduled" ? (
          <EmailTable
            loading={loading}
            emptyMessage="No scheduled emails yet. Compose a new campaign to get started."
            columns={["Email", "Subject", "Scheduled Time", "Status"]}
            rows={scheduledRows}
          />
        ) : (
          <EmailTable
            loading={loading}
            emptyMessage="No sent emails yet."
            columns={["Email", "Subject", "Sent Time", "Status", "Details"]}
            rows={sentRows}
          />
        )}
      </main>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduled={loadEmails}
      />
    </div>
  );
}
