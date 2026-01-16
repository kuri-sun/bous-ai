import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteSession } from "../api/sessions";
import type { SessionSummary } from "../api/sessions";
import { Button } from "./ui/Button";

type SidebarProps = {
  sessions: SessionSummary[];
  isLoading?: boolean;
};

export function Sidebar({ sessions, isLoading = false }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeId = useMemo(() => {
    const parts = location.pathname.split("/");
    if (parts[1] === "sessions" && parts[2]) {
      return parts[2];
    }
    return null;
  }, [location.pathname]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteSession(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      if (activeId === id) {
        navigate("/");
      }
      setDeletingId(null);
    },
    onError: () => {
      setDeletingId(null);
    },
  });

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
            <div
              key={session.id}
              className={`w-full border-b border-gray-100 px-3 py-2 text-left text-sm ${
                activeId === session.id ? "bg-gray-50" : ""
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  navigate(
                    session.status === "done"
                      ? `/sessions/${session.id}/summary`
                      : `/sessions/${session.id}`,
                  )
                }
                className="w-full text-left hover:text-gray-900"
              >
                <p className="font-semibold text-gray-900">{displayName}</p>
              </button>
              <div className="mt-2 flex items-center justify-end">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (deleteMutation.isPending || deletingId === session.id) {
                      return;
                    }
                    if (
                      !window.confirm(
                        "この防災マニュアルを削除します。よろしいですか？",
                      )
                    ) {
                      return;
                    }
                    setDeletingId(session.id);
                    deleteMutation.mutate(session.id);
                  }}
                  disabled={
                    deleteMutation.isPending || deletingId === session.id
                  }
                >
                  {deletingId === session.id ? "削除中..." : "削除"}
                </Button>
              </div>
            </div>
          );
        })
      )}
    </aside>
  );
}
