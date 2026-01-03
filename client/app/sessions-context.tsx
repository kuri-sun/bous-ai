"use client";

import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSessions, type SessionSummary } from "../api/sessions";

type SessionsContextValue = {
  sessions: SessionSummary[];
};

const SessionsContext = createContext<SessionsContextValue>({
  sessions: [],
});

export function SessionsProvider({ children }: { children: React.ReactNode }) {
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
