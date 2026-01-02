"use client";

import { useMemo, useState } from "react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type ChatResponse = {
  reply: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: createId(),
      role: "assistant",
      content:
        "Ask anything and I will answer with help from Vertex AI. Try asking for a short plan or a summary.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const historyPayload = useMemo(
    () =>
      messages.map(({ role, content }) => ({
        role,
        content,
      })),
    [messages]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Request failed");
      }

      const data: ChatResponse = await response.json();
      const assistantMessage: Message = {
        id: createId(),
        role: "assistant",
        content: data.reply || "No response received.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">FastAPI + Vertex AI</p>
        <h1>Signal Chat</h1>
        <p className="subtitle">
          A lightweight CSR chat client wired to your FastAPI service. Every
          prompt goes straight to Vertex AI.
        </p>
      </section>

      <section className="chat">
        <div className="chat-header">
          <div>
            <h2>Conversation</h2>
            <p>Messages stream back when the server responds.</p>
          </div>
          <span className={isSending ? "status live" : "status"}>
            {isSending ? "Thinking" : "Ready"}
          </span>
        </div>

        <div className="chat-body">
          {messages.map((message) => (
            <div key={message.id} className={`bubble ${message.role}`}>
              <span className="role">{message.role}</span>
              <p>{message.content}</p>
            </div>
          ))}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <div className="input-wrap">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for a summary, a list, or a quick plan."
              rows={3}
            />
          </div>
          <div className="composer-footer">
            <span className="hint">POST {API_BASE}/chat</span>
            <button type="submit" disabled={isSending}>
              {isSending ? "Sending" : "Send"}
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
