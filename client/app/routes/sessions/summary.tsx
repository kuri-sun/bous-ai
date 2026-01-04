import { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchSessionDetail, NotFoundError } from "../../api/sessions";
import { API_BASE } from "../../constants";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function SessionSummaryPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = typeof params.id === "string" ? params.id : null;
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const pdfUrl = useMemo(() => {
    if (!sessionId) {
      return "";
    }
    return `${API_BASE}/api/sessions/${sessionId}/download`;
  }, [sessionId]);

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
            href={pdfUrl}
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

      {session?.status === "done" ? (
        <div className="mt-2 max-w-xl rounded-md border border-emerald-100 bg-white">
          <div className="flex justify-center overflow-x-auto">
            <Document
              file={pdfUrl}
              onLoadSuccess={(data) => {
                setPageCount(data.numPages);
                setPageNumber(1);
              }}
              loading={
                <p className="text-sm text-emerald-700">読み込み中...</p>
              }
              error={
                <p className="text-sm text-red-600">
                  PDFのプレビューに失敗しました。
                </p>
              }
            >
              <Page
                pageNumber={pageNumber}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                width={470}
              />
            </Document>
          </div>
          {pageCount ? (
            <div className="px-4 pb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-600">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                  disabled={pageNumber <= 1}
                  className="rounded-md border border-emerald-200 px-3 py-1 text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  前へ
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPageNumber((prev) => Math.min(pageCount, prev + 1))
                  }
                  disabled={pageNumber >= pageCount}
                  className="rounded-md border border-emerald-200 px-3 py-1 text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  次へ
                </button>
              </div>
              <p>
                全{pageCount}ページ中 {pageNumber}ページ目を表示しています。
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
