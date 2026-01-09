import { API_BASE } from "../constants";
import type { FormSchema } from "../types/manual";

type SessionDetail = {
  id: string;
  name?: string | null;
  status?: string | null;
  inputs?: Record<string, unknown> | null;
  form?: FormSchema | null;
  msg?: string | null;
};

type SessionDetailResponse = {
  session: SessionDetail;
};

type SessionSummary = {
  id: string;
  name?: string | null;
  status?: string | null;
};

type SessionsResponse = {
  sessions: SessionSummary[];
};

export class NotFoundError extends Error {
  status = 404;
}

export const fetchSessionDetail = async (id: string) => {
  const response = await fetch(`${API_BASE}/api/sessions/${id}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError("Session not found");
    }
    throw new Error("Failed to load session");
  }
  return (await response.json()) as SessionDetailResponse;
};

export const fetchSessions = async () => {
  const response = await fetch(`${API_BASE}/api/sessions`);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as SessionsResponse;
  return data.sessions;
};

export const createSession = async (name: string) => {
  const response = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "セッションの作成に失敗しました。");
  }
  return (await response.json()) as SessionDetailResponse;
};

export type {
  SessionDetail,
  SessionDetailResponse,
  SessionsResponse,
  SessionSummary,
};
