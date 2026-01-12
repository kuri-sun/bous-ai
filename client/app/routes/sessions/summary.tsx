import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideAgenticProposal,
  respondAgenticConversation,
  startAgenticConversation,
} from "../../api/agentic";
import { fetchSessionDetail, NotFoundError } from "../../api/sessions";
import { API_BASE } from "../../constants";
import type { AgenticState } from "../../types/agentic";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function SessionSummaryPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = typeof params.id === "string" ? params.id : null;
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [agentic, setAgentic] = useState<AgenticState | null>(null);
  const [agenticError, setAgenticError] = useState("");
  const [agenticInput, setAgenticInput] = useState("");
  const [pdfVersion, setPdfVersion] = useState(0);
  const queryClient = useQueryClient();
  const pdfUrl = useMemo(() => {
    if (!sessionId) {
      return "";
    }
    const suffix = pdfVersion ? `?v=${pdfVersion}` : "";
    return `${API_BASE}/api/sessions/${sessionId}/download${suffix}`;
  }, [pdfVersion, sessionId]);

  const {
    data: sessionDetail,
    error: sessionError,
    isLoading,
  } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId as string),
    enabled: Boolean(sessionId),
  });

  useEffect(() => {
    setAgentic(sessionDetail?.session?.agentic ?? null);
  }, [sessionDetail?.session?.agentic]);

  const agenticStartMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) {
        throw new Error("セッションIDが取得できません。");
      }
      return startAgenticConversation(sessionId);
    },
    onSuccess: (data) => {
      setAgentic(data.agentic);
      setAgenticError("");
      setAgenticInput("");
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setAgenticError(message);
    },
  });

  const agenticRespondMutation = useMutation({
    mutationFn: async (answer: string) => {
      if (!sessionId) {
        throw new Error("セッションIDが取得できません。");
      }
      return respondAgenticConversation(sessionId, answer);
    },
    onSuccess: (data) => {
      setAgentic(data.agentic);
      setAgenticError("");
      setAgenticInput("");
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setAgenticError(message);
    },
  });

  const agenticDecisionMutation = useMutation({
    mutationFn: async (decision: "yes" | "no") => {
      if (!sessionId) {
        throw new Error("セッションIDが取得できません。");
      }
      return decideAgenticProposal(sessionId, decision);
    },
    onSuccess: (data, decision) => {
      setAgentic(data.agentic);
      setAgenticError("");
      if (decision === "yes") {
        setPdfVersion(Date.now());
        queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      }
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setAgenticError(message);
    },
  });

  const isNotFound = sessionError instanceof NotFoundError || !sessionId;
  const showInitialLoading = isLoading && !sessionDetail;
  const session = sessionDetail?.session ?? null;
  const agenticStatus = agentic?.status ?? "idle";
  const isAgenticBusy =
    agenticStartMutation.isPending ||
    agenticRespondMutation.isPending ||
    agenticDecisionMutation.isPending;
  const showAgenticStart = !agentic;
  const displayedHistory = useMemo(() => {
    if (!agentic?.history) {
      return [];
    }
    if (agenticStatus === "proposal" && agentic?.proposal) {
      return agentic.history.filter(
        (message) =>
          !(
            message.role === "assistant" &&
            message.content.trim() === agentic.proposal?.trim()
          ),
      );
    }
    return agentic.history;
  }, [agentic?.history, agentic?.proposal, agenticStatus]);

  if (isNotFound) {
    return (
      <section className="flex h-full items-center justify-center bg-white text-gray-700">
        ページが見つかりません。
      </section>
    );
  }

  return (
    <section className="bg-white p-8 text-gray-900">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">生成結果</h2>
        {session?.status === "done" ? (
          <a
            href={pdfUrl}
            download="manual.pdf"
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            PDFをダウンロード
          </a>
        ) : null}
      </header>

      {session?.status !== "done" ? (
        <p className="text-sm text-gray-700">PDFがまだ生成されていません。</p>
      ) : null}

      <div className="mt-2 flex flex-col gap-6 lg:flex-row">
        {session?.status === "done" ? (
          <div className="min-h-[700px] w-full max-w-xl rounded-md border border-gray-200 bg-white">
            <div className="flex items-center justify-center overflow-x-auto">
              <Document
                file={pdfUrl}
                onLoadSuccess={(data) => {
                  setPageCount(data.numPages);
                  setPageNumber(1);
                }}
                loading={
                  <div className="flex h-[670px] items-center justify-center text-sm text-gray-600">
                    PDF読み込み中...
                  </div>
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
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPageNumber((prev) => Math.max(1, prev - 1))
                    }
                    disabled={pageNumber <= 1}
                    className="rounded-md border border-gray-200 px-3 py-1 text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    前へ
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPageNumber((prev) => Math.min(pageCount, prev + 1))
                    }
                    disabled={pageNumber >= pageCount}
                    className="rounded-md border border-gray-200 px-3 py-1 text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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

        <section className="w-full rounded-md border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mt-1 text-sm text-gray-600">
                このAgentは、地域行政が出している公式防災マニュアルの例をを参照し、改善を提案します。
              </p>
            </div>
            {showAgenticStart ? (
              <button
                type="button"
                disabled={session?.status !== "done" || isAgenticBusy}
                onClick={() => agenticStartMutation.mutate()}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {agenticStartMutation.isPending
                  ? "実行中..."
                  : "Agent編集を開始"}
              </button>
            ) : (
              <div className="text-xs text-gray-500">Agent編集を実行中</div>
            )}
          </div>
          {session?.status !== "done" ? (
            <p className="mt-3 text-xs text-gray-600">
              PDF生成後に実行できます。
            </p>
          ) : null}
          {agenticError ? (
            <p className="mt-3 text-sm text-red-600">{agenticError}</p>
          ) : null}
          <div className="mt-4 flex flex-col gap-4">
            <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
              {showInitialLoading ? (
                <p className="text-sm text-gray-600">読み込み中...</p>
              ) : null}
              {agentic?.search?.result ? (
                <div className="space-y-2 text-sm text-gray-700">
                  <p className="text-xs text-gray-500">
                    検索条件: {agentic.search.query}（{agentic.search.scope}）
                  </p>
                  <a
                    href={agentic.search.result.link}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-gray-900 underline"
                  >
                    {agentic.search.result.title}
                  </a>
                  {agentic.search.result.snippet ? (
                    <p className="text-xs text-gray-600">
                      {agentic.search.result.snippet}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {displayedHistory.length ? (
                <div className="space-y-2">
                  {displayedHistory.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`rounded-md border px-3 py-2 text-sm whitespace-pre-wrap ${
                        message.role === "assistant"
                          ? "border-gray-200 bg-gray-50 text-gray-800"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
              ) : null}
              {agenticStatus === "proposal" && !showInitialLoading ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">
                      改定提案
                    </h4>
                    {/* TODO: 将来的に提案テキストのインライン編集を追加する */}
                    <p className="mt-2 text-sm text-gray-700">
                      {agentic?.proposal ?? agentic?.turn?.content}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => agenticDecisionMutation.mutate("no")}
                      disabled={isAgenticBusy}
                      className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {agenticDecisionMutation.isPending
                        ? "送信中..."
                        : "いいえ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => agenticDecisionMutation.mutate("yes")}
                      disabled={isAgenticBusy}
                      className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {agenticDecisionMutation.isPending ? "反映中..." : "はい"}
                    </button>
                  </div>
                </div>
              ) : null}
              {agenticStatus === "accepted" ? (
                <p className="text-xs text-gray-600">
                  提案を反映しました。PDFを更新済みです。
                </p>
              ) : null}
              {agenticStatus === "rejected" ? (
                <p className="text-xs text-gray-600">
                  提案を見送りました。必要であれば再実行してください。
                </p>
              ) : null}
            </div>

            {!showInitialLoading && agentic && !showAgenticStart ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!agenticInput.trim()) {
                    return;
                  }
                  if (
                    agenticStatus === "question" ||
                    agenticStatus === "proposal" ||
                    agenticStatus === "accepted" ||
                    agenticStatus === "rejected"
                  ) {
                    agenticRespondMutation.mutate(agenticInput.trim());
                  }
                }}
              >
                <label className="block">
                  <textarea
                    value={agenticInput}
                    onChange={(event) => setAgenticInput(event.target.value)}
                    rows={3}
                    placeholder="例: 居住者は50世帯、地下に備蓄倉庫あり"
                    className="mt-2 w-full rounded-md border border-gray-200 p-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={
                      isAgenticBusy ||
                      !agenticInput.trim() ||
                      ![
                        "question",
                        "proposal",
                        "accepted",
                        "rejected",
                      ].includes(agenticStatus)
                    }
                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {agenticRespondMutation.isPending
                      ? "送信中..."
                      : "メッセージを送信"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
