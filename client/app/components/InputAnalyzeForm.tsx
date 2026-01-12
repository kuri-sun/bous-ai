import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AnalyzeResponse } from "../types/manual";
import { API_BASE } from "../constants";
import { Button } from "./ui/Button";
import { FieldLabel, Textarea } from "./ui/Form";

type InputAnalyzeFormProps = {
  sampleMemo: string;
  sampleFileUrl?: string;
  defaultTextInput?: string;
  sessionId?: string | null;
  onAnalyzed: (result: AnalyzeResponse) => void;
  submitLabel?: string;
  submitLoadingLabel?: string;
  isBusy?: boolean;
  busyLabel?: string;
};

export type InputAnalyzeFormHandle = {
  fillSample: () => Promise<void>;
};

export const InputAnalyzeForm = forwardRef<
  InputAnalyzeFormHandle,
  InputAnalyzeFormProps
>(
  (
    {
      sampleMemo,
      sampleFileUrl,
      defaultTextInput = "",
      sessionId = null,
      onAnalyzed,
      submitLabel = "不足情報を抽出",
      submitLoadingLabel = "解析中...",
      isBusy = false,
      busyLabel = "処理中...",
    },
    ref,
  ) => {
    const [textInput, setTextInput] = useState(defaultTextInput);
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const queryClient = useQueryClient();

    const analyzeMutation = useMutation({
      mutationFn: async (formData: FormData) => {
        const response = await fetch(`${API_BASE}/api/analyze`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "解析に失敗しました。");
        }

        return (await response.json()) as AnalyzeResponse;
      },
      onSuccess: (data) => {
        onAnalyzed(data);
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : "予期しないエラーです。";
        setError(message);
      },
      onSettled: () => {
        setIsAnalyzing(false);
      },
    });

    const handleAnalyze = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isAnalyzing) {
        return;
      }

      if (!textInput.trim() && !file) {
        setError("テキストまたはファイルを入力してください。");
        return;
      }

      setIsAnalyzing(true);
      setError("");

      const formData = new FormData();
      formData.append("source_type", "mixed");
      if (textInput.trim()) {
        formData.append("text", textInput.trim());
      }
      if (file) {
        formData.append("file", file);
      }
      if (sessionId) {
        formData.append("session_id", sessionId);
      }

      analyzeMutation.mutate(formData);
    };

    const loadSampleFile = useCallback(async () => {
      if (!sampleFileUrl) {
        return;
      }
      try {
        const response = await fetch(sampleFileUrl);
        if (!response.ok) {
          throw new Error("サンプルPDFの取得に失敗しました。");
        }
        const blob = await response.blob();
        const filename =
          sampleFileUrl.split("/").pop() || "sample-document.pdf";
        const newFile = new File([blob], filename, {
          type: blob.type || "application/pdf",
        });
        setFile(newFile);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "予期しないエラーです。";
        setError(message);
      }
    }, [sampleFileUrl]);

    useImperativeHandle(
      ref,
      () => ({
        fillSample: async () => {
          setTextInput(sampleMemo);
          setError("");
          await loadSampleFile();
        },
      }),
      [sampleMemo, loadSampleFile],
    );

    return (
      <form className="space-y-5" onSubmit={handleAnalyze}>
        <label className="block">
          <FieldLabel htmlFor="text-input">メモ</FieldLabel>
          <Textarea
            id="text-input"
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            placeholder="例: 2024年1月 防災会議で決定した避難場所や連絡体制..."
            rows={5}
          />
        </label>
        <label className="block">
          <FieldLabel htmlFor="sample-file">PDF/画像ファイル</FieldLabel>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="sample-file"
              type="file"
              accept=".pdf,image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="hidden"
            />
            <label
              htmlFor="sample-file"
              className="inline-flex cursor-pointer items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:border-gray-300"
            >
              ファイルを選択
            </label>
            <span className="text-sm text-gray-700">
              {file ? file.name : "選択されていません"}
            </span>
          </div>
          {file ? (
            <small className="mt-2 block text-xs text-gray-700">
              選択中: {file.name}
            </small>
          ) : null}
        </label>
        <div className="flex items-center justify-between gap-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : <span />}
          <Button type="submit" disabled={isAnalyzing || isBusy}>
            {isAnalyzing
              ? submitLoadingLabel
              : isBusy
                ? busyLabel
                : submitLabel}
          </Button>
        </div>
      </form>
    );
  },
);

InputAnalyzeForm.displayName = "InputAnalyzeForm";
