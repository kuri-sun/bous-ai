import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionsProvider } from "../contexts/SessionsContext";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionsProvider>{children}</SessionsProvider>
    </QueryClientProvider>
  );
}
