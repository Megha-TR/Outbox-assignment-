export interface ScheduledEmail {
  id: string;
  recipientEmail: string;
  subject: string;
  scheduledAt: string;
  status: string;
}

export interface SentEmail {
  id: string;
  recipientEmail: string;
  subject: string;
  sentAt: string | null;
  status: string;
  errorMessage?: string | null;
}

export interface ScheduleResponse {
  campaignId: string;
  scheduledCount: number;
  leadsDetected: number;
}
