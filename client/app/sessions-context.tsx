"use client";

import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "../constants";

type SessionSummary = {
  id: string;
  status?: string | null;
  pdf_url?: string | null;
};

type SessionsResponse = {
  sessions: SessionSummary[];
};

type SessionsContextValue = {
  sessions: SessionSummary[];
};

const SessionsContext = createContext<SessionsContextValue>({
  sessions: [],
});

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const fetchSessions = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions`);
      if (!response.ok) {
        return [];
      }
      const data: SessionsResponse = await response.json();
      return data.sessions;
    } catch {
      return [];
    }
  };

  const { data = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  return (
    <SessionsContext.Provider value={{ sessions: data }}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  return useContext(SessionsContext);
}
