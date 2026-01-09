import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSession } from "../../api/sessions";

export default function SessionCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionName, setSessionName] = useState("");
  const [createError, setCreateError] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => createSession(name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setCreateError("");
      setSessionName("");
      navigate(`/sessions/${data.session.id}`);
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setCreateError(message);
    },
  });

  return (
    <section className="h-full bg-white text-gray-900">
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900">
            セッション名を入力
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            後から見つけやすい名前を付けてください。
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = sessionName.trim();
              if (!trimmed) {
                setCreateError("セッション名を入力してください。");
                return;
              }
              setCreateError("");
              createMutation.mutate(trimmed);
            }}
          >
            <input
              type="text"
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
              placeholder="例: 2024年度 防災マニュアル"
              className="w-full rounded-md border border-gray-200 p-3 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            {createError ? (
              <p className="text-sm text-red-600">{createError}</p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:border-gray-300"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? "開始中..." : "開始"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
