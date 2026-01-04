import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import type { SessionSummary } from "../api/sessions";
import LoadingIndicator from "./LoadingIndicator";

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
    <aside className="h-full overflow-y-auto border-r border-emerald-100">
      <div className="px-3 py-3">
        <button
          type="button"
          onClick={() => navigate("/sessions/create")}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-left text-sm font-semibold text-white hover:bg-emerald-700"
        >
          マニュアルを作成
        </button>
      </div>
      {isLoading ? (
        <div className="px-3 py-2">
          <LoadingIndicator size="sm" label="読み込み中" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="px-3 py-2 text-xs text-emerald-700">
          セッションがまだありません。
        </p>
      ) : (
        sessions.map((session) => (
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
            className={`w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 ${
              activeId === session.id ? "bg-emerald-50" : ""
            }`}
          >
            <p className="font-semibold text-emerald-900">
              {session.id.slice(0, 8)}
            </p>
            <p className="mt-1 text-emerald-700">
              状態: {session.status ?? "step1"}
            </p>
          </button>
        ))
      )}
    </aside>
  );
}
