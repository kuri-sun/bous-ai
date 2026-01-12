import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, string>>({
    defaultValues: buildInitialAnswers(analyzeResult, initialAnswers),
  });

  useEffect(() => {
    reset(buildInitialAnswers(analyzeResult, initialAnswers));
    clearErrors();
  }, [analyzeResult, initialAnswers, reset, clearErrors]);

  const generateMutation = useMutation({
    mutationFn: async (answers: Record<string, string>) => {
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
      setError("root", { type: "server", message });
    },
  });

  const handleGenerate = handleSubmit((formValues) => {
    if (!analyzeResult) {
      return;
    }
    if (!analyzeResult?.session_id) {
      setError("root", {
        type: "manual",
        message: "セッションIDが取得できません。",
      });
      return;
    }

    clearErrors("root");
    generateMutation.mutate(formValues);
  });

  return (
    <form className="space-y-6" onSubmit={handleGenerate}>
      {analyzeResult ? (
        <div className="space-y-5">
          {analyzeResult.form.fields.map((field) => (
            <label key={field.id} className="block">
              <FieldLabel required={field.required}>{field.label}</FieldLabel>
              {field.field_type === "textarea" ? (
                <Textarea
                  {...register(field.id, {
                    required: field.required ? "必須項目です" : false,
                  })}
                  placeholder={field.placeholder}
                  rows={4}
                />
              ) : field.field_type === "select" ? (
                <Select
                  {...register(field.id, {
                    required: field.required ? "必須項目です" : false,
                  })}
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
                  {...register(field.id, {
                    required: field.required ? "必須項目です" : false,
                  })}
                  placeholder={field.placeholder}
                />
              )}
              {errors[field.id]?.message ? (
                <p className="mt-1 text-xs text-red-600">
                  {errors[field.id]?.message as string}
                </p>
              ) : null}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-700">
          まず「不足情報を抽出」を実行してください。
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="submit"
          disabled={
            !analyzeResult || isSubmitting || generateMutation.isPending
          }
        >
          {generateMutation.isPending ? "PDF生成中..." : "PDFを作成"}
        </Button>
      </div>
      {errors.root?.message ? (
        <p className="text-sm text-red-600">{errors.root.message as string}</p>
      ) : null}
    </form>
  );
}
