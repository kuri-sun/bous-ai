import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchSessionDetail, NotFoundError } from "../../api/sessions";
import { API_BASE } from "../../constants";

export default function SessionSummaryPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = typeof params.id === "string" ? params.id : null;

  const {
    data: sessionDetail,
    error: sessionError,
    isLoading,
  } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId as string),
    enabled: Boolean(sessionId),
  });

  if (sessionError instanceof NotFoundError || !sessionId) {
    return (
      <section className="flex h-full items-center justify-center bg-white text-emerald-700">
        ページが見つかりません。
      </section>
    );
  }

  if (isLoading && !sessionDetail) {
    return (
      <section className="flex h-full items-center justify-center bg-white text-emerald-700">
        読み込み中...
      </section>
    );
  }

  const session = sessionDetail?.session ?? null;

  return (
    <section className="bg-white p-8 text-emerald-950">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">生成結果</h2>
        {session?.status === "done" ? (
          <a
            href={`${API_BASE}/api/sessions/${sessionId}/download`}
            download="manual.pdf"
            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            PDFをダウンロード
          </a>
        ) : null}
      </header>

      {session?.status !== "done" ? (
        <p className="text-sm text-emerald-700">
          PDFがまだ生成されていません。
        </p>
      ) : null}
    </section>
  );
}
