import { useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ManualGenerateForm,
  type ManualGenerateFormHandle,
} from "../../components/ManualGenerateForm";
import { Button } from "../../components/ui/Button";
import { SAMPLE_MEMO } from "../../constants";
import { fetchSessionDetail, NotFoundError } from "../../api/sessions";

export default function SessionDetailPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = typeof params.id === "string" ? params.id : null;
  const generateFormRef = useRef<ManualGenerateFormHandle | null>(null);
  const [isFillingSample, setIsFillingSample] = useState(false);

  const {
    data: sessionDetail,
    error: sessionError,
    isLoading,
  } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId as string),
    enabled: Boolean(sessionId),
    retry: false,
  });

  const session = sessionDetail?.session ?? null;
  const inputDefaults = useMemo(() => {
    const step2 = (session?.inputs?.step2 ?? {}) as Record<string, unknown>;
    return {
      memo: typeof step2.memo === "string" ? step2.memo : "",
    };
  }, [session?.inputs]);

  if (sessionError instanceof NotFoundError || !sessionId) {
    return <Navigate to="/" replace />;
  }

  if (isLoading && !sessionDetail) {
    return null;
  }

  return (
    <section className="bg-white p-8 text-gray-900">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">メモと差し込み画像の入力</h2>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            if (!generateFormRef.current) {
              return;
            }
            setIsFillingSample(true);
            await generateFormRef.current.fillSample();
            setIsFillingSample(false);
          }}
          disabled={isFillingSample}
        >
          {isFillingSample ? "入力中..." : "サンプルを入力"}
        </Button>
      </header>

      <ManualGenerateForm
        key={`session-input-${sessionId}`}
        ref={generateFormRef}
        sampleMemo={SAMPLE_MEMO}
        sampleImages={[
          {
            url: "/assets/escape.png",
            description: "マンションの避難経路図の写真。",
          },
          {
            url: "/assets/garage.png",
            description: "マンションの備品倉庫内の写真。",
          },
        ]}
        defaultMemo={inputDefaults.memo}
        sessionId={sessionId}
        submitLabel="PDFを作成"
        submitLoadingLabel="生成中..."
      />
    </section>
  );
}
