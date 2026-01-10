import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPlaceAutocomplete, fetchPlaceDetails } from "../../api/places";
import { createSession } from "../../api/sessions";
import type { PlaceDetail, PlacePrediction } from "../../types/place";

export default function SessionCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [searchError, setSearchError] = useState("");

  const createMutation = useMutation({
    mutationFn: (place: PlaceDetail) => createSession(place),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setSearchError("");
      setSearchInput("");
      setPredictions([]);
      navigate(`/sessions/${data.session.id}`);
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setSearchError(message);
    },
  });

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (!trimmed) {
      setPredictions([]);
      setSearchError("");
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
        setSearchError("");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        const message =
          err instanceof Error ? err.message : "予期しないエラーです。";
        setSearchError(message);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchInput]);

  const handleSelect = async (prediction: PlacePrediction) => {
    setIsFetchingDetail(true);
    setSearchError("");
    try {
      const place = await fetchPlaceDetails(prediction.place_id);
      createMutation.mutate(place);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setSearchError(message);
    } finally {
      setIsFetchingDetail(false);
    }
  };

  return (
    <section className="h-full bg-white text-gray-900">
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900">
            住所・施設名を検索
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            候補から選択するとセッションを開始します。
          </p>
          <div className="mt-5 space-y-3">
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="例: XXマンション"
              className="w-full rounded-md border border-gray-200 p-3 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            {searchError ? (
              <p className="text-sm text-red-600">{searchError}</p>
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
            !searchError ? (
              <p className="text-xs text-gray-600">
                候補が見つかりませんでした。
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:border-gray-300"
              >
                キャンセル
              </button>
              <span className="text-xs text-gray-600">
                {isFetchingDetail || createMutation.isPending
                  ? "セッション開始中..."
                  : null}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
