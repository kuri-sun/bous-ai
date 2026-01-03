"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NotFound from "../../not-found";
import { useQuery } from "@tanstack/react-query";
import { InputAnalyzeForm } from "../../../components/InputAnalyzeForm";
import { MissingInfoForm } from "../../../components/MissingInfoForm";
import type { AnalyzeResponse, FormSchema } from "../../../types/manual";
import { API_BASE, SAMPLE_MEMO } from "../../../constants";

type SessionDetail = {
  id: string;
  status?: string | null;
  pdf_url?: string | null;
  inputs?: Record<string, unknown> | null;
  form?: FormSchema | null;
  msg?: string | null;
};

type SessionDetailResponse = {
  session: SessionDetail;
};

class NotFoundError extends Error {
  status = 404;
}

const fetchSessionDetail = async (id: string) => {
  const response = await fetch(`${API_BASE}/api/sessions/${id}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError("Session not found");
    }
    throw new Error("Failed to load session");
  }
  return (await response.json()) as SessionDetailResponse;
};

export default function SessionPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : null;

  if (!sessionId) {
    return <NotFound />;
  }

  return <SessionPageContent key={sessionId} sessionId={sessionId} />;
}

function SessionPageContent({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [stepOverride, setStepOverride] = useState<1 | 2 | null>(null);
  const [analyzeOverride, setAnalyzeOverride] =
    useState<AnalyzeResponse | null>(null);

  const { data: sessionDetail, error: sessionError } = useQuery({
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
    } satisfies AnalyzeResponse;
  }, [session, step1Extracted]);
  const analyzeResult = analyzeOverride ?? derivedAnalyzeResult;
  const initialAnswers = useMemo(() => {
    if (analyzeOverride || !session?.form) {
      return undefined;
    }
    const step2 = (inputs.step2 ?? {}) as Record<string, unknown>;
    const answers: Record<string, string> = {};
    session.form.fields.forEach((field) => {
      const value = step2[field.id];
      answers[field.id] = typeof value === "string" ? value : "";
    });
    return answers;
  }, [analyzeOverride, inputs.step2, session]);
  const step = stepOverride ?? stepFromStatus;

  const handleAnalyzed = (data: AnalyzeResponse) => {
    setAnalyzeOverride(data);
    setStepOverride(2);
    if (data.session_id) {
      router.push(`/sessions/${data.session_id}`);
    }
  };

  if (sessionError instanceof NotFoundError) {
    return <NotFound />;
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
          key={`session-missing-${analyzeOverride ? "override" : "session"}`}
          analyzeResult={analyzeResult}
          sessionId={sessionId}
          initialAnswers={initialAnswers}
        />
      )}
    </section>
  );
}
