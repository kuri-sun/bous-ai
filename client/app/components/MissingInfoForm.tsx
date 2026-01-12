import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import type { AnalyzeResponse } from "../types/manual";
import { API_BASE } from "../constants";
import { Button } from "./ui/Button";
import { FieldLabel, Select, Textarea, TextInput } from "./ui/Form";

type GenerateResponse = {
  session?: {
    id: string;
    status?: string | null;
  } | null;
};

type MissingInfoFormProps = {
  analyzeResult: AnalyzeResponse | null;
  initialAnswers?: Record<string, string> | null;
};

const buildInitialAnswers = (
  analyzeResult: AnalyzeResponse | null,
  initialAnswers?: Record<string, string> | null,
) => {
  if (!analyzeResult?.form?.fields) {
    return {};
  }
  const seed = initialAnswers ?? {};
  const answers: Record<string, string> = {};
  analyzeResult.form.fields.forEach((field) => {
    answers[field.id] = seed[field.id] ?? "";
  });
  return answers;
};

export function MissingInfoForm({
  analyzeResult,
  initialAnswers,
}: MissingInfoFormProps) {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    buildInitialAnswers(analyzeResult, initialAnswers),
  );
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: analyzeResult?.session_id,
          extracted: analyzeResult?.extracted ?? null,
          answers,
          source_meta: { source_type: "mixed" },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "PDF生成に失敗しました。");
      }

      return (await response.json()) as GenerateResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      if (analyzeResult?.session_id) {
        navigate(`/sessions/${analyzeResult.session_id}/summary`);
      }
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setError(message);
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  const handleGenerate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!analyzeResult || isGenerating) {
      return;
    }
    if (!analyzeResult?.session_id) {
      setError("セッションIDが取得できません。");
      return;
    }

    setIsGenerating(true);
    setError("");
    generateMutation.mutate();
  };

  return (
    <form className="space-y-6" onSubmit={handleGenerate}>
      {analyzeResult ? (
        <div className="space-y-5">
          {analyzeResult.form.fields.map((field) => (
            <label key={field.id} className="block">
              <FieldLabel required={field.required}>{field.label}</FieldLabel>
              {field.field_type === "textarea" ? (
                <Textarea
                  value={answers[field.id] ?? ""}
                  placeholder={field.placeholder}
                  rows={4}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [field.id]: event.target.value,
                    }))
                  }
                />
              ) : field.field_type === "select" ? (
                <Select
                  value={answers[field.id] ?? ""}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [field.id]: event.target.value,
                    }))
                  }
                >
                  <option value="">選択してください</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  type="text"
                  value={answers[field.id] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [field.id]: event.target.value,
                    }))
                  }
                />
              )}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-700">
          まず「不足情報を抽出」を実行してください。
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="submit" disabled={!analyzeResult || isGenerating}>
          {isGenerating ? "PDF生成中..." : "PDFを作成"}
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
