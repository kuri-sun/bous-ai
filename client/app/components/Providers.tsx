import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useIsFetching,
  useIsMutating,
} from "@tanstack/react-query";
import LoadingIndicator from "./LoadingIndicator";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoadingOverlay>{children}</GlobalLoadingOverlay>
    </QueryClientProvider>
  );
}

function GlobalLoadingOverlay({ children }: ProvidersProps) {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isBusy = isFetching + isMutating > 0;

  return (
    <>
      {children}
      {isBusy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-md bg-white px-6 py-4 shadow-lg">
            <LoadingIndicator size="sm" label="処理中..." />
          </div>
        </div>
      ) : null}
    </>
  );
}
