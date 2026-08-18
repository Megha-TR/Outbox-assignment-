import type {
  ScheduledEmail,
  SentEmail,
  ScheduleResponse,
} from "@/types/email";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getAuthToken(): Promise<string> {
  const res = await fetch("/api/auth/token");
  if (!res.ok) {
    throw new Error("Not authenticated");
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export async function fetchScheduledEmails(): Promise<ScheduledEmail[]> {
  const data = await apiFetch<{ emails: ScheduledEmail[] }>("/api/scheduled");
  return data.emails;
}

export async function fetchSentEmails(): Promise<SentEmail[]> {
  const data = await apiFetch<{ emails: SentEmail[] }>("/api/sent");
  return data.emails;
}

export async function parseLeadsFile(file: File): Promise<number> {
  const token = await getAuthToken();
  const formData = new FormData();
  formData.append("leadsFile", file);

  const response = await fetch(`${API_URL}/api/parse-leads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to parse leads file");
  }

  const data = (await response.json()) as { count: number };
  return data.count;
}

export async function scheduleEmails(formData: FormData): Promise<ScheduleResponse> {
  const token = await getAuthToken();
  const response = await fetch(`${API_URL}/api/schedule`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to schedule" }));
    throw new Error(error.error ?? "Failed to schedule emails");
  }

  return response.json() as Promise<ScheduleResponse>;
}
