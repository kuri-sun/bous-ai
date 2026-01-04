import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { InputAnalyzeForm } from "../../components/InputAnalyzeForm";
import { MissingInfoForm } from "../../components/MissingInfoForm";
import type { AnalyzeResponse } from "../../types/manual";
import { SAMPLE_MEMO } from "../../constants";

export default function SessionCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(
    null,
  );

  const formHint = useMemo(() => {
    if (!analyzeResult) {
      return "解析すると不足情報がフォームに表示されます。";
    }
    return analyzeResult.msg;
  }, [analyzeResult]);

  const handleAnalyzed = (data: AnalyzeResponse) => {
    setAnalyzeResult(data);
    setStep(2);
    if (data.session_id) {
      navigate(`/sessions/${data.session_id}`);
    }
  };

  return (
    <section className="bg-white p-8 text-emerald-950">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">
          {step === 1
            ? "マニュアル作成のための情報を入力"
            : "マニュアル生成にあたり整理すべき情報"}
        </h2>
        {step === 2 ? (
          <p className="mt-2 text-sm text-emerald-700">{formHint}</p>
        ) : null}
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
        />
      )}
    </section>
  );
}
