import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { API_BASE } from "../constants";
import { Button } from "./ui/Button";
import { FieldLabel, Textarea } from "./ui/Form";

export type ManualGenerateFormHandle = {
  fillSample: () => Promise<void>;
};

type ManualGenerateFormProps = {
  sessionId: string | null;
  defaultMemo?: string;
  sampleMemo: string;
  sampleImages?: { url: string; description: string }[];
  submitLabel?: string;
  submitLoadingLabel?: string;
  isBusy?: boolean;
  busyLabel?: string;
};

type FormImage = {
  file: File | null;
  description: string;
};

type FormValues = {
  memo: string;
  images: FormImage[];
};

type GenerateResponse = {
  session?: {
    id: string;
    status?: string | null;
  } | null;
};

export const ManualGenerateForm = forwardRef<
  ManualGenerateFormHandle,
  ManualGenerateFormProps
>(
  (
    {
      sessionId,
      defaultMemo = "",
      sampleMemo,
      sampleImages = [],
      submitLabel = "PDFを作成",
      submitLoadingLabel = "生成中...",
      isBusy = false,
      busyLabel = "PDF生成中...",
    },
    ref,
  ) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
  const {
      register,
      control,
      handleSubmit,
      setValue,
      setError,
      clearErrors,
      watch,
      reset,
      formState: { errors, isSubmitting },
  } = useForm<FormValues>({
      defaultValues: {
        memo: defaultMemo,
        images: [{ file: null, description: "" }],
      },
    });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "images",
  });

  const watchedImages = watch("images");
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([]);

  useEffect(() => {
    setPreviewUrls((prevUrls) => {
      const nextUrls = watchedImages.map((image, index) => {
        const file = image?.file;
        if (!file) {
          if (prevUrls[index]) {
            URL.revokeObjectURL(prevUrls[index] as string);
          }
          return null;
        }
        const prevUrl = prevUrls[index];
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return URL.createObjectURL(file);
      });
      prevUrls.slice(nextUrls.length).forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
      return nextUrls;
    });
  }, [watchedImages]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [previewUrls]);

    useImperativeHandle(
      ref,
      () => ({
        fillSample: async () => {
          try {
            const loadedImages = await Promise.all(
              sampleImages.map(async (sample) => {
                const response = await fetch(sample.url);
                if (!response.ok) {
                  throw new Error("サンプル画像の取得に失敗しました。");
                }
                const blob = await response.blob();
                const filename =
                  sample.url.split("/").pop() || "sample-image";
                const file = new File([blob], filename, {
                  type: blob.type || "image/png",
                });
                return { file, description: sample.description };
              }),
            );
            const images =
              loadedImages.length > 0
                ? loadedImages
                : [{ file: null, description: "" }];
            reset({ memo: sampleMemo, images });
            clearErrors();
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "予期しないエラーです。";
            setError("root", { type: "server", message });
          }
        },
      }),
      [reset, sampleMemo, sampleImages, clearErrors, setError],
    );

    const generateMutation = useMutation({
      mutationFn: async (formData: FormData) => {
        const response = await fetch(`${API_BASE}/api/generate`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "PDF生成に失敗しました。");
        }

        return (await response.json()) as GenerateResponse;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
        if (data.session?.id) {
          navigate(`/sessions/${data.session.id}/summary`);
        }
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : "予期しないエラーです。";
        setError("root", { type: "server", message });
      },
    });

    const handleGenerate = handleSubmit((values) => {
      if (!sessionId) {
        setError("root", {
          type: "manual",
          message: "セッションIDが取得できません。",
        });
        return;
      }

      const memoValue = values.memo.trim();
      const selectedImages = values.images.filter((image) => image.file);
      if (!memoValue && selectedImages.length === 0) {
        setError("root", {
          type: "manual",
          message: "メモまたは画像を入力してください。",
        });
        return;
      }

      let hasError = false;
      values.images.forEach((image, index) => {
        const hasFile = Boolean(image.file);
        const hasDescription = Boolean(image.description.trim());
        if (hasFile && !hasDescription) {
          hasError = true;
          setError(`images.${index}.description`, {
            type: "manual",
            message: "補足説明を入力してください。",
          });
        }
        if (!hasFile && hasDescription) {
          hasError = true;
          setError(`images.${index}.file`, {
            type: "manual",
            message: "画像ファイルを選択してください。",
          });
        }
      });

      if (hasError) {
        return;
      }

      clearErrors("root");
      const formData = new FormData();
      formData.append("session_id", sessionId);
      if (memoValue) {
        formData.append("memo", memoValue);
      }
      let sentPairs = 0;
      values.images.forEach((image) => {
        if (!image.file) {
          return;
        }
        formData.append("images", image.file);
        formData.append("image_descriptions", image.description.trim());
        sentPairs += 1;
      });
      generateMutation.mutate(formData);
    });

    return (
      <form className="space-y-6" onSubmit={handleGenerate}>
        <label className="block">
          <FieldLabel htmlFor="memo">メモ</FieldLabel>
          <Textarea
            id="memo"
            rows={5}
            placeholder="例: 2024年1月 防災会議で決定した避難場所や連絡体制..."
            {...register("memo")}
          />
        </label>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <FieldLabel>差し込み画像</FieldLabel>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ file: null, description: "" })}
            >
              画像を追加
            </Button>
          </div>

          {fields.map((field, index) => {
            const image = watchedImages?.[index];
            return (
              <div
                key={field.id}
                className="rounded-md border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800">
                    画像 {index + 1}
                  </p>
                  {fields.length > 1 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      削除
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-col gap-4 md:flex-row">
                  <div className="md:w-1/2">
                    <input
                      id={`image-${index}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const newFile = event.target.files?.[0] ?? null;
                        setValue(`images.${index}.file`, newFile, {
                          shouldValidate: true,
                        });
                        clearErrors([`images.${index}.file`, "root"]);
                      }}
                    />
                    <label
                      htmlFor={`image-${index}`}
                      className="inline-flex cursor-pointer items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:border-gray-300"
                    >
                      画像を選択
                    </label>
                    <span className="ml-3 text-sm text-gray-700">
                      {image?.file?.name ?? "選択されていません"}
                    </span>
                    {errors.images?.[index]?.file?.message ? (
                      <p className="mt-1 text-xs text-red-600">
                        {String(errors.images?.[index]?.file?.message)}
                      </p>
                    ) : null}
                    {previewUrls[index] ? (
                      <div className="mt-3 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                        <img
                          src={previewUrls[index] as string}
                          alt={`画像 ${index + 1} のプレビュー`}
                          className="h-40 w-full object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                  <label className="block md:w-1/2">
                    <FieldLabel htmlFor={`image-desc-${index}`} required>
                      補足説明
                    </FieldLabel>
                    <Textarea
                      id={`image-desc-${index}`}
                      rows={6}
                      placeholder="例: エントランスに掲示してある避難経路図"
                      {...register(`images.${index}.description`)}
                    />
                    {errors.images?.[index]?.description?.message ? (
                      <p className="mt-1 text-xs text-red-600">
                        {String(errors.images?.[index]?.description?.message)}
                      </p>
                    ) : null}
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          {errors.root?.message ? (
            <p className="text-sm text-red-600">{errors.root.message}</p>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={isSubmitting || isBusy}>
            {isSubmitting
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

ManualGenerateForm.displayName = "ManualGenerateForm";
