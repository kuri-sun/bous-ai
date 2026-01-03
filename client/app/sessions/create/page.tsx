"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InputAnalyzeForm } from "../../../components/InputAnalyzeForm";
import { MissingInfoForm } from "../../../components/MissingInfoForm";
import type { AnalyzeResponse } from "../../../types/manual";
import { SAMPLE_MEMO } from "../../../constants";

export default function CreateSessionPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(
    null,
  );
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleAnalyzed = (data: AnalyzeResponse) => {
    setAnalyzeResult(data);
    setSessionId(data.session_id ?? null);
    setStep(2);
    if (data.session_id) {
      router.push(`/sessions/${data.session_id}`);
    }
  };

  return (
    <section className="bg-white p-8 text-emerald-950">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">
          {step === 1 ? "入力と解析" : "不足情報入力"}
        </h2>
      </header>

      {step === 1 ? (
        <InputAnalyzeForm
          key="create-analyze"
          sampleMemo={SAMPLE_MEMO}
          onAnalyzed={handleAnalyzed}
        />
      ) : (
        <MissingInfoForm
          key={analyzeResult ? "create-missing" : "create-empty"}
          analyzeResult={analyzeResult}
          sessionId={sessionId}
        />
      )}
    </section>
  );
}
