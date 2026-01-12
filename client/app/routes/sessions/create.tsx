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

export default function SessionCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<{ search: string }>({
    defaultValues: { search: "" },
  });
  const searchInput = watch("search") ?? "";
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  const createMutation = useMutation({
    mutationFn: (place: PlaceDetail) => createSession(place),
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
  }, [searchInput, clearErrors, setError]);

  const handleSelect = async (prediction: PlacePrediction) => {
    setIsFetchingDetail(true);
    clearErrors("root");
    try {
      const place = await fetchPlaceDetails(prediction.place_id);
      createMutation.mutate(place);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setError("root", { type: "server", message });
    } finally {
      setIsFetchingDetail(false);
    }
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
          <div className="space-y-3">
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
                    className="w-full border-b border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
              <p className="text-xs text-gray-600">
                候補が見つかりませんでした。
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => navigate("/")}
              >
                キャンセル
              </Button>
              <span className="text-xs text-gray-600">
                {isFetchingDetail || createMutation.isPending
                  ? "セッション開始中..."
                  : null}
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}
