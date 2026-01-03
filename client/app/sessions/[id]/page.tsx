"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NotFound from "../../not-found";
import { useQuery } from "@tanstack/react-query";
import { InputAnalyzeForm } from "../../../components/InputAnalyzeForm";
import { MissingInfoForm } from "../../../components/MissingInfoForm";
import type { AnalyzeResponse } from "../../../types/manual";
import { SAMPLE_MEMO } from "../../../constants";
import { fetchSessionDetail, NotFoundError } from "../../../api/sessions";

export default function SessionPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : null;
  const router = useRouter();
  const [overrideState, setOverrideState] = useState<{
    sessionId: string | null;
    step: 1 | 2 | null;
    analyze: AnalyzeResponse | null;
  }>({ sessionId: null, step: null, analyze: null });

  const {
    data: sessionDetail,
    error: sessionError,
    isLoading,
  } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId),
    enabled: Boolean(sessionId),
  });

  const session = sessionDetail?.session ?? null;
  const inputs = (session?.inputs ?? {}) as Record<string, unknown>;
  const inputDefaults = useMemo(() => {
    const step1 = (session?.inputs?.step1 ?? {}) as Record<string, unknown>;
    return {
      memo: typeof step1.memo === "string" ? step1.memo : "",
      fileDescription:
        typeof step1.file_description === "string"
          ? step1.file_description
          : "",
    };
  }, [session?.inputs]);
  const step1Extracted = (session?.inputs?.step1_extracted ?? null) as Record<
    string,
    unknown
  > | null;
  const statusValue =
    typeof session?.status === "string" ? session.status.trim() : "";
  const stepFromStatus =
    statusValue === "step2" || statusValue === "done" ? 2 : 1;
  const derivedAnalyzeResult = useMemo(() => {
    if (!session?.form || !Array.isArray(session.form.fields)) {
      return null;
    }
    return {
      msg: typeof session.msg === "string" ? session.msg : "",
      form: session.form,
      extracted: step1Extracted ?? undefined,
      session_id: session?.id,
    } satisfies AnalyzeResponse;
  }, [session, step1Extracted]);
  const effectiveOverride =
    overrideState.sessionId === sessionId
      ? overrideState
      : { sessionId: null, step: null, analyze: null };
  const analyzeResult = effectiveOverride.analyze ?? derivedAnalyzeResult;
  const initialAnswers = useMemo(() => {
    if (effectiveOverride.analyze || !session?.form) {
      return undefined;
    }
    const step2 = (inputs.step2 ?? {}) as Record<string, unknown>;
    const answers: Record<string, string> = {};
    session.form.fields.forEach((field) => {
      const value = step2[field.id];
      answers[field.id] = typeof value === "string" ? value : "";
    });
    return answers;
  }, [effectiveOverride.analyze, inputs.step2, session]);
  const step = effectiveOverride.step ?? stepFromStatus;

  const handleAnalyzed = (data: AnalyzeResponse) => {
    setOverrideState({ sessionId, step: 2, analyze: data });
    if (data.session_id) {
      router.push(`/sessions/${data.session_id}`);
    }
  };

  if (sessionError instanceof NotFoundError || !sessionId) {
    return <NotFound />;
  }

  if (isLoading && !sessionDetail) {
    return (
      <section className="flex h-full items-center justify-center bg-white text-emerald-700">
        読み込み中...
      </section>
    );
  }

  return (
    <section className="bg-white p-8 text-emerald-950">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">
          {step === 1 ? "入力と解析" : "不足情報入力"}
        </h2>
      </header>

      {step === 1 ? (
        <InputAnalyzeForm
          key={`session-input-${sessionId}`}
          sampleMemo={SAMPLE_MEMO}
          defaultTextInput={inputDefaults.memo}
          defaultFileDescription={inputDefaults.fileDescription}
          onAnalyzed={handleAnalyzed}
        />
      ) : (
        <MissingInfoForm
          key={`session-missing-${
            effectiveOverride.analyze ? "override" : "session"
          }`}
          analyzeResult={analyzeResult}
          initialAnswers={initialAnswers}
        />
      )}
    </section>
  );
}
