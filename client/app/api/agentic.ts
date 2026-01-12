import { API_BASE } from "../constants";
import type {
  AgenticConversationResponse,
  AgenticDecisionResponse,
} from "../types/agentic";

export const startAgenticConversation = async (sessionId: string) => {
  const response = await fetch(`${API_BASE}/api/agentic/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Agent編集の取得に失敗しました。");
  }
  return (await response.json()) as AgenticConversationResponse;
};

export const respondAgenticConversation = async (
  sessionId: string,
  answer: string,
) => {
  const response = await fetch(`${API_BASE}/api/agentic/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, answer }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Agent編集の送信に失敗しました。");
  }
  return (await response.json()) as AgenticConversationResponse;
};

export const decideAgenticProposal = async (
  sessionId: string,
  decision: "yes" | "no",
) => {
  const response = await fetch(`${API_BASE}/api/agentic/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, decision }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Agent編集の反映に失敗しました。");
  }
  return (await response.json()) as AgenticDecisionResponse;
};
