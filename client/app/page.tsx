"use client";

import { useEffect, useMemo, useState } from "react";

type FormField = {
  id: string;
  label: string;
  field_type: "text" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
};

type FormSchema = {
  fields: FormField[];
};

type AnalyzeResponse = {
  msg: string;
  form: FormSchema;
  extracted?: Record<string, unknown>;
  session_id?: string;
};

type GenerateResponse = {
  filename: string;
  pdf_base64: string;
};

type SessionSummary = {
  id: string;
  status?: string | null;
  pdf_url?: string | null;
};

type SessionsResponse = {
  sessions: SessionSummary[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const decodeBase64Pdf = (payload: string) => {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "application/pdf" });
};

export default function Home() {
  const [step, setStep] = useState<1 | 2>(1);
  const [textInput, setTextInput] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(
    null,
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const sampleMemo =
    "2024年10月16日 マンション理事会 防災関連メモ\n" +
    "場所: 管理組合会議室（19:00-20:30）\n" +
    "参加: 理事長、理事3名、管理会社担当、防災担当\n" +
    "\n" +
    "1. 避難場所・集合\n" +
    "一次避難: 第一小学校（徒歩8分、収容目安250名）\n" +
    "二次避難: 中央公園（広域避難、徒歩15分）\n" +
    "集合場所: マンション南側広場（点呼・安否確認）\n" +
    "\n" +
    "2. 連絡体制\n" +
    "災害発生時: 管理組合→各階責任者→居住者\n" +
    "手段: 掲示板・館内放送・LINEオープンチャット\n" +
    "緊急時は館内放送を最優先、夜間はLINE併用\n" +
    "\n" +
    "3. 高齢者・要支援者対応\n" +
    "要支援者名簿は各階責任者が月1回更新\n" +
    "搬送は同フロアの2名体制、階段補助具を活用\n" +
    "\n" +
    "4. 備蓄品・点検\n" +
    "水: 1人3日分を目標（現状2日分、年内に追加購入）\n" +
    "簡易食・毛布・簡易トイレは11月末に在庫確認\n" +
    "発電機は年2回作動確認、次回は12月に実施\n" +
    "\n" +
    "5. 課題と次回対応\n" +
    "夜間連絡網不足→連絡先更新フォームを11月配布\n" +
    "階段灯の停電対策→蓄電式ライト見積を依頼\n";

  const formHint = useMemo(() => {
    if (!analyzeResult) {
      return "解析すると不足情報がフォームに表示されます。";
    }
    return analyzeResult.msg;
  }, [analyzeResult]);

  const loadSessions = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions`);
      if (!response.ok) {
        return;
      }
      const data: SessionsResponse = await response.json();
      setSessions(data.sessions);
    } catch {
      // ignore list errors
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const handleAnalyze = async (event: React.FormEvent) => {
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
    setPdfUrl(null);

    const formData = new FormData();
    formData.append("source_type", "mixed");
    if (textInput.trim()) {
      formData.append("text", textInput.trim());
    }
    if (fileDescription.trim()) {
      formData.append("file_description", fileDescription.trim());
    }
    if (file) {
      formData.append("file", file);
    }

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "解析に失敗しました。");
      }

      const data: AnalyzeResponse = await response.json();
      setAnalyzeResult(data);
      setSessionId(data.session_id ?? null);
      const initialAnswers: Record<string, string> = {};
      data.form.fields.forEach((field) => {
        initialAnswers[field.id] = "";
      });
      setAnswers(initialAnswers);
      setStep(2);
      void loadSessions();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!analyzeResult || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          extracted: analyzeResult.extracted ?? null,
          answers,
          source_meta: { source_type: "mixed" },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "PDF生成に失敗しました。");
      }

      const data: GenerateResponse = await response.json();
      const blob = decodeBase64Pdf(data.pdf_base64);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      void loadSessions();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "予期しないエラーです。";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="flex h-full w-full text-emerald-950">
      <div className="h-full w-full">
        <div className="grid h-full grid-cols-5">
          <aside className="col-span-1 flex h-full flex-col border-r border-emerald-100 p-4">
            <div className="flex-1 space-y-3 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-xs text-emerald-700">
                  セッションがまだありません。
                </p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`px-3 py-2 text-sm ${
                      sessionId === session.id
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-emerald-100 bg-white"
                    }`}
                  >
                    <p className="font-semibold text-emerald-900">
                      {session.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-emerald-700">
                      状態: {session.status ?? "step1"}
                    </p>
                    {session.pdf_url ? (
                      <a
                        href={session.pdf_url}
                        className="mt-2 inline-flex text-emerald-800 underline"
                      >
                        PDF
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className="col-span-4 flex h-full flex-col overflow-y-auto bg-white p-8">
            <header className="mb-6">
              <h2 className="text-xl font-semibold">
                {step === 1 ? "入力と解析" : "不足情報入力"}
              </h2>
              {step === 2 ? (
                <p className="mt-2 text-sm text-emerald-700">{formHint}</p>
              ) : null}
            </header>

            {step === 1 ? (
              <form className="space-y-5" onSubmit={handleAnalyze}>
                <label className="block">
                  <span className="text-sm font-medium text-emerald-800">
                    メモ/議事録（テキスト）
                  </span>
                  <textarea
                    value={textInput}
                    onChange={(event) => setTextInput(event.target.value)}
                    placeholder="例: 2024年1月 防災会議で決定した避難場所や連絡体制..."
                    rows={5}
                    className="mt-2 w-full rounded-md border border-emerald-200 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setTextInput(sampleMemo)}
                    className="mt-3 inline-flex items-center rounded-md border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-800 hover:border-emerald-300"
                  >
                    サンプルを入力
                  </button>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-emerald-800">
                    見本PDF/画像ファイル
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      id="sample-file"
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(event) =>
                        setFile(event.target.files?.[0] ?? null)
                      }
                      className="hidden"
                    />
                    <label
                      htmlFor="sample-file"
                      className="inline-flex cursor-pointer items-center rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:border-emerald-300"
                    >
                      ファイルを選択
                    </label>
                    <span className="text-sm text-emerald-700">
                      {file ? file.name : "選択されていません"}
                    </span>
                  </div>
                  {file ? (
                    <small className="mt-2 block text-xs text-emerald-700">
                      選択中: {file.name}
                    </small>
                  ) : null}
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-emerald-800">
                    ファイルの説明
                  </span>
                  <input
                    type="text"
                    value={fileDescription}
                    onChange={(event) => setFileDescription(event.target.value)}
                    placeholder="例: 前年度の防災マニュアル見本"
                    className="mt-2 w-full rounded-md border border-emerald-200 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </label>
                <div className="flex items-center justify-between gap-3">
                  {error ? (
                    <p className="text-sm text-red-600">{error}</p>
                  ) : (
                    <span />
                  )}
                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isAnalyzing ? "解析中..." : "不足情報を抽出"}
                  </button>
                </div>
              </form>
            ) : (
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
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-md border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-800 hover:border-emerald-300"
                  >
                    入力へ戻る
                  </button>
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
              </form>
            )}
          </section>
        </div>

        {step === 2 && error ? (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    </main>
  );
}
