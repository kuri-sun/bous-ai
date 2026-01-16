import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import type { SessionSummary } from "../api/sessions";
import { Button } from "./ui/Button";

type SidebarProps = {
  sessions: SessionSummary[];
  isLoading?: boolean;
};

export function Sidebar({ sessions, isLoading = false }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeId = useMemo(() => {
    const parts = location.pathname.split("/");
    if (parts[1] === "sessions" && parts[2]) {
      return parts[2];
    }
    return null;
  }, [location.pathname]);

  return (
    <aside className="h-full overflow-y-auto border-r border-gray-200">
      <div className="px-3 py-3">
        <Button
          type="button"
          fullWidth
          onClick={() => navigate("/sessions/create")}
        >
          防災マニュアルを作成
        </Button>
      </div>
      {isLoading || sessions.length === 0 ? (
        <p className="px-3 py-2 text-xs text-gray-700">
          セッションがまだありません。
        </p>
      ) : (
        sessions.map((session) => {
          const placeName = session.place?.name?.trim();
          const placeAddress = session.place?.formatted_address?.trim();
          const displayName =
            placeName ?? placeAddress ?? `セッション ${session.id.slice(0, 8)}`;
          return (
            <button
              key={session.id}
              type="button"
              onClick={() =>
                navigate(
                  session.status === "done"
                    ? `/sessions/${session.id}/summary`
                    : `/sessions/${session.id}`,
                )
              }
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                activeId === session.id ? "bg-gray-50" : ""
              }`}
            >
              <p className="font-semibold text-gray-900">{displayName}</p>
              <p className="mt-1 text-xs text-gray-700">
                状態: {session.status ?? "step2"}
              </p>
            </button>
          );
        })
      )}
    </aside>
  );
}
