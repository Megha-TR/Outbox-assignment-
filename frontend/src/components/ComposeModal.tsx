"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "./Button";
import { Input, TextArea } from "./Input";
import { parseLeadsFile, scheduleEmails } from "@/lib/api";
import {
  defaultStartTime,
  minStartTime,
  parseLocalDateTime,
} from "@/lib/datetime";

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

export function ComposeModal({ open, onClose, onScheduled }: ComposeModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("2");
  const [hourlyLimit, setHourlyLimit] = useState("50");
  const [senderEmails, setSenderEmails] = useState("");
  const [leadsFile, setLeadsFile] = useState<File | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !startTime) {
      setStartTime(defaultStartTime());
    }
  }, [open, startTime]);

  if (!open) return null;

  async function handleFileChange(file: File | null) {
    setLeadsFile(file);
    setLeadCount(null);
    if (!file) return;
    try {
      const count = await parseLeadsFile(file);
      setLeadCount(count);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Not authenticated")
          ? "Session expired. Please log in again."
          : "Could not parse leads file. Check that backend is running and env secrets match."
      );
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!leadsFile) {
      setError("Please upload a CSV or text file with email leads");
      return;
    }

    setLoading(true);
    setError(null);

    const scheduledStart = parseLocalDateTime(startTime);
    if (Number.isNaN(scheduledStart.getTime())) {
      setError("Invalid start time");
      setLoading(false);
      return;
    }
    if (scheduledStart.getTime() <= Date.now()) {
      setError("Start time must be in the future");
      setLoading(false);
      return;
    }
    if (scheduledStart.getFullYear() < new Date().getFullYear()) {
      setError(`Start time year looks wrong (${scheduledStart.getFullYear()}). Please pick ${new Date().getFullYear()} or later.`);
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("subject", subject);
      formData.append("body", body);
      formData.append("startTime", scheduledStart.toISOString());
      formData.append("delayBetweenMs", String(Number(delaySeconds) * 1000));
      formData.append("hourlyLimit", hourlyLimit);
      formData.append("leadsFile", leadsFile);
      if (senderEmails.trim()) {
        formData.append("senderEmails", senderEmails);
      }

      await scheduleEmails(formData);
      onScheduled();
      onClose();
      setSubject("");
      setBody("");
      setStartTime("");
      setLeadsFile(null);
      setLeadCount(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule emails");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Compose New Email</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
          <TextArea
            label="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              Upload leads (CSV or .txt)
            </span>
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600"
              required
            />
            {leadCount !== null && (
              <p className="text-xs text-brand-700">
                {leadCount} email address{leadCount === 1 ? "" : "es"} detected
              </p>
            )}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Start time"
              type="datetime-local"
              value={startTime}
              min={minStartTime()}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
            {startTime && (
              <p className="text-xs text-slate-500 md:col-span-2">
                First email will send at:{" "}
                {parseLocalDateTime(startTime).toLocaleString()}
              </p>
            )}
            <Input
              label="Delay between emails (seconds)"
              type="number"
              min="0"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              required
            />
            <Input
              label="Hourly limit"
              type="number"
              min="1"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              required
            />
            <Input
              label="Sender emails (comma-separated, optional)"
              value={senderEmails}
              onChange={(e) => setSenderEmails(e.target.value)}
              placeholder="sender1@example.com, sender2@example.com"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
