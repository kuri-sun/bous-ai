"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AnalyzeResponse } from "../types/manual";
import { API_BASE } from "../constants";

type GenerateResponse = {
  filename: string;
  pdf_base64: string;
};

type MissingInfoFormProps = {
  analyzeResult: AnalyzeResponse | null;
  sessionId: string | null;
  initialAnswers?: Record<string, string> | null;
};

const decodeBase64Pdf = (payload: string) => {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "application/pdf" });
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
  sessionId,
  initialAnswers,
}: MissingInfoFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    buildInitialAnswers(analyzeResult, initialAnswers),
  );
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
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
    onSuccess: (data) => {
      const blob = decodeBase64Pdf(data.pdf_base64);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
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
    if (!sessionId) {
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
              <span className="text-sm font-medium text-emerald-800">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.field_type === "textarea" ? (
                <textarea
                  value={answers[field.id] ?? ""}
                  placeholder={field.placeholder}
                  rows={4}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [field.id]: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-emerald-200 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              ) : field.field_type === "select" ? (
                <select
                  value={answers[field.id] ?? ""}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [field.id]: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-emerald-200 bg-white p-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="">選択してください</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={answers[field.id] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [field.id]: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-emerald-200 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              )}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-emerald-700">
          まず「不足情報を抽出」を実行してください。
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={!analyzeResult || isGenerating}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? "PDF生成中..." : "PDFを作成"}
        </button>
      </div>
      {pdfUrl ? (
        <div>
          <a
            href={pdfUrl}
            download="manual.pdf"
            className="inline-flex items-center rounded-md border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-800 hover:border-emerald-300"
          >
            PDFをダウンロード
          </a>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
