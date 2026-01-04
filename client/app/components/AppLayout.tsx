import { useQuery } from "@tanstack/react-query";
import { fetchSessions } from "../api/sessions";
import { Sidebar } from "./Sidebar";

type AppLayoutProps = {
  children: React.ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  return (
    <>
      <header className="h-16 border-b border-emerald-100 bg-white/90">
        <div className="flex h-full w-full max-w-6xl items-center justify-between px-4">
          <span className="text-sm font-semibold text-emerald-900">
            防災マニュアル作成
          </span>
        </div>
      </header>
      <div className="h-[calc(100vh-4rem)]">
        <div className="grid h-full grid-cols-[240px_1fr]">
          <Sidebar sessions={sessions} isLoading={isLoading} />
          <main className="h-full overflow-y-auto">{children}</main>
        </div>
      </div>
    </>
  );
}
