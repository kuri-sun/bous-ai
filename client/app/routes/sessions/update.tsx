import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  InputAnalyzeForm,
  type InputAnalyzeFormHandle,
} from "../../components/InputAnalyzeForm";
import type { AnalyzeResponse } from "../../types/manual";
import { API_BASE, SAMPLE_MEMO } from "../../constants";
import { fetchSessionDetail, NotFoundError } from "../../api/sessions";

export default function SessionDetailPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = typeof params.id === "string" ? params.id : null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const analyzeFormRef = useRef<InputAnalyzeFormHandle | null>(null);
  const [generateError, setGenerateError] = useState("");
  const [isFillingSample, setIsFillingSample] = useState(false);

  const {
    data: sessionDetail,
    error: sessionError,
    isLoading,
  } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId as string),
    enabled: Boolean(sessionId),
  });

  const session = sessionDetail?.session ?? null;
  const inputDefaults = useMemo(() => {
    const step1 = (session?.inputs?.step1 ?? {}) as Record<string, unknown>;
    return {
      memo: typeof step1.memo === "string" ? step1.memo : "",
    };
  }, [session?.inputs]);

  const generateMutation = useMutation({
    mutationFn: async (payload: {
      sessionId: string;
      extracted: Record<string, unknown> | null;
    }) => {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: payload.sessionId,
          extracted: payload.extracted ?? null,
          answers: {},
          source_meta: { source_type: "mixed" },
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "PDF生成に失敗しました。");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      if (sessionId) {
        navigate(`/sessions/${sessionId}/summary`);
      }
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setGenerateError(message);
    },
  });

  const handleAnalyzed = (data: AnalyzeResponse) => {
    setGenerateError("");
    if (data.session_id) {
      generateMutation.mutate({
        sessionId: data.session_id,
        extracted: (data.extracted as Record<string, unknown>) ?? null,
      });
    } else {
      setGenerateError("セッションIDが取得できません。");
    }
  };

  if (sessionError instanceof NotFoundError || !sessionId) {
    return (
      <section className="flex h-full items-center justify-center bg-white text-gray-700">
        ページが見つかりません。
      </section>
    );
  }

  if (isLoading && !sessionDetail) {
    return (
      <section className="flex h-full items-center justify-center bg-white text-gray-700" />
    );
  }

  return (
    <section className="bg-white p-8 text-gray-900">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">メモとPDF/画像ファイル入力</h2>
        <button
          type="button"
          onClick={async () => {
            if (!analyzeFormRef.current) {
              return;
            }
            setIsFillingSample(true);
            await analyzeFormRef.current.fillSample();
            setIsFillingSample(false);
          }}
          disabled={isFillingSample}
          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-800 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFillingSample ? "入力中..." : "サンプルを入力"}
        </button>
      </header>

      <InputAnalyzeForm
        key={`session-input-${sessionId}`}
        ref={analyzeFormRef}
        sampleMemo={SAMPLE_MEMO}
        sampleFileUrl="/assets/tokyo_manshion.pdf"
        defaultTextInput={inputDefaults.memo}
        sessionId={sessionId}
        onAnalyzed={handleAnalyzed}
        submitLabel="PDFを作成"
        submitLoadingLabel="解析中..."
        isBusy={generateMutation.isPending}
        busyLabel="PDF生成中..."
      />
      {generateError ? (
        <p className="mt-4 text-sm text-red-600">{generateError}</p>
      ) : null}
    </section>
  );
}
