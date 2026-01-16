import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { fetchPlaceAutocomplete, fetchPlaceDetails } from "../../api/places";
import { createSession } from "../../api/sessions";
import { Button } from "../../components/ui/Button";
import { FieldLabel, TextInput } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import type { PlaceDetail, PlacePrediction } from "../../types/place";

const getPredictionLabel = (prediction: PlacePrediction | null) =>
  prediction?.description ??
  prediction?.main_text ??
  prediction?.secondary_text ??
  "";

export default function SessionCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = useForm<{ search: string; manualTitle: string }>({
    defaultValues: { search: "", manualTitle: "" },
  });
  const searchInput = watch("search") ?? "";
  const manualTitle = watch("manualTitle") ?? "";
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [selectedPrediction, setSelectedPrediction] =
    useState<PlacePrediction | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  const createMutation = useMutation({
    mutationFn: (place: PlaceDetail) =>
      createSession(place, manualTitle.trim()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      clearErrors("root");
      setPredictions([]);
      navigate(`/sessions/${data.session.id}`);
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setError("root", { type: "server", message });
    },
  });

  useEffect(() => {
    const selectedLabel = getPredictionLabel(selectedPrediction);
    if (selectedPrediction && searchInput.trim() === selectedLabel.trim()) {
      setPredictions([]);
      setIsSearching(false);
      return;
    }
    if (selectedPrediction) {
      setSelectedPrediction(null);
    }
    const trimmed = searchInput.trim();
    if (!trimmed) {
      setPredictions([]);
      clearErrors("root");
      return;
    }
    setIsSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await fetchPlaceAutocomplete(
          trimmed,
          controller.signal,
        );
        setPredictions(results);
        clearErrors("root");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        const message =
          err instanceof Error ? err.message : "予期しないエラーです。";
        setError("root", { type: "server", message });
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchInput, selectedPrediction, clearErrors, setError]);

  const handleSubmitForm = handleSubmit(async () => {
    if (!selectedPrediction) {
      setError("root", {
        type: "manual",
        message: "候補から住所を選択してください。",
      });
      return;
    }
    setIsFetchingDetail(true);
    clearErrors("root");
    try {
      const place = await fetchPlaceDetails(selectedPrediction.place_id);
      createMutation.mutate(place);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setError("root", { type: "server", message });
    } finally {
      setIsFetchingDetail(false);
    }
  });

  const handleSelect = (prediction: PlacePrediction) => {
    setSelectedPrediction(prediction);
    const label = getPredictionLabel(prediction);
    if (label) {
      setValue("search", label, { shouldValidate: true });
    }
    setPredictions([]);
    clearErrors("root");
  };

  return (
    <section className="h-full bg-white text-gray-900">
      <Modal>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">
            住所・施設名を検索
          </h2>
          <p className="text-sm text-gray-700">
            候補から選択するとセッションを開始します。
          </p>
          <form className="space-y-3" onSubmit={handleSubmitForm}>
            <div>
              <FieldLabel htmlFor="manual-title" required>
                マニュアルタイトル
              </FieldLabel>
              <TextInput
                id="manual-title"
                type="text"
                {...register("manualTitle", {
                  required: "必須項目です",
                })}
                placeholder="例: ○○マンション 防災マニュアル"
              />
              {errors.manualTitle?.message ? (
                <p className="mt-1 text-xs text-red-600">
                  {String(errors.manualTitle.message)}
                </p>
              ) : null}
            </div>
            <div>
              <FieldLabel htmlFor="place-search">施設名または住所</FieldLabel>
              <TextInput
                id="place-search"
                type="text"
                {...register("search")}
                placeholder="例: XXマンション"
              />
            </div>
            {errors.root?.message ? (
              <p className="text-sm text-red-600">
                {String(errors.root.message)}
              </p>
            ) : null}
            {isSearching ? (
              <p className="text-xs text-gray-600">検索中...</p>
            ) : null}
            {predictions.length > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200">
                {predictions.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    type="button"
                    onClick={() => handleSelect(prediction)}
                    disabled={isFetchingDetail || createMutation.isPending}
                    className={`w-full border-b border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selectedPrediction?.place_id === prediction.place_id
                        ? "bg-gray-50"
                        : ""
                    }`}
                  >
                    <p className="font-medium text-gray-900">
                      {prediction.main_text ?? prediction.description}
                    </p>
                    {prediction.secondary_text ? (
                      <p className="mt-1 text-xs text-gray-600">
                        {prediction.secondary_text}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            {searchInput.trim() &&
            predictions.length === 0 &&
            !isSearching &&
            !errors.root ? (
              <span />
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => navigate("/")}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                size="md"
                disabled={isFetchingDetail || createMutation.isPending}
              >
                {isFetchingDetail || createMutation.isPending
                  ? "セッション開始中..."
                  : "セッションを開始"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </section>
  );
}
