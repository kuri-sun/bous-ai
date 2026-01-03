"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NotFound from "../../not-found";
import { useQuery } from "@tanstack/react-query";
import {
  InputAnalyzeForm,
  MissingInfoForm,
  type AnalyzeResponse,
  type FormSchema,
} from "../../components/manual-forms";

type SessionDetail = {
  id: string;
  status?: string | null;
  pdf_url?: string | null;
  inputs?: Record<string, unknown> | null;
  form?: FormSchema | null;
  msg?: string | null;
};

type SessionDetailResponse = {
  session: SessionDetail;
};

class NotFoundError extends Error {
  status = 404;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

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

const fetchSessionDetail = async (id: string) => {
  const response = await fetch(`${API_BASE}/api/sessions/${id}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError("Session not found");
    }
    throw new Error("Failed to load session");
  }
  return (await response.json()) as SessionDetailResponse;
};

export default function SessionPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : null;

  if (!sessionId) {
    return <NotFound />;
  }

  return <SessionPageContent key={sessionId} sessionId={sessionId} />;
}

function SessionPageContent({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [stepOverride, setStepOverride] = useState<1 | 2 | null>(null);
  const [analyzeOverride, setAnalyzeOverride] =
    useState<AnalyzeResponse | null>(null);

  const { data: sessionDetail, error: sessionError } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId),
    enabled: Boolean(sessionId),
  });

  const session = sessionDetail?.session ?? null;
  const inputs = (session?.inputs ?? {}) as Record<string, unknown>;
  const inputDefaults = useMemo(() => {
    const step1 = (session?.inputs?.step1 ?? {}) as Record<string, unknown>;
    return {
      memo: typeof step1.memo === "string" ? step1.memo : "",
      fileDescription:
        typeof step1.file_description === "string"
          ? step1.file_description
          : "",
    };
  }, [session?.inputs]);
  const step1Extracted = (session?.inputs?.step1_extracted ?? null) as Record<
    string,
    unknown
  > | null;
  const statusValue =
    typeof session?.status === "string" ? session.status.trim() : "";
  const stepFromStatus =
    statusValue === "step2" || statusValue === "done" ? 2 : 1;
  const derivedAnalyzeResult = useMemo(() => {
    if (!session?.form || !Array.isArray(session.form.fields)) {
      return null;
    }
    return {
      msg: typeof session.msg === "string" ? session.msg : "",
      form: session.form,
      extracted: step1Extracted ?? undefined,
    } satisfies AnalyzeResponse;
  }, [session, step1Extracted]);
  const analyzeResult = analyzeOverride ?? derivedAnalyzeResult;
  const initialAnswers = useMemo(() => {
    if (analyzeOverride || !session?.form) {
      return undefined;
    }
    const step2 = (inputs.step2 ?? {}) as Record<string, unknown>;
    const answers: Record<string, string> = {};
    session.form.fields.forEach((field) => {
      const value = step2[field.id];
      answers[field.id] = typeof value === "string" ? value : "";
    });
    return answers;
  }, [analyzeOverride, inputs.step2, session]);
  const step = stepOverride ?? stepFromStatus;

  const handleAnalyzed = (data: AnalyzeResponse) => {
    setAnalyzeOverride(data);
    setStepOverride(2);
    if (data.session_id) {
      router.push(`/sessions/${data.session_id}`);
    }
  };

  if (sessionError instanceof NotFoundError) {
    return <NotFound />;
  }

  return (
    <section className="bg-white p-8 text-emerald-950">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">
          {step === 1 ? "入力と解析" : "不足情報入力"}
        </h2>
      </header>

      {step === 1 ? (
        <InputAnalyzeForm
          key={`session-input-${sessionId}`}
          sampleMemo={sampleMemo}
          defaultTextInput={inputDefaults.memo}
          defaultFileDescription={inputDefaults.fileDescription}
          onAnalyzed={handleAnalyzed}
        />
      ) : (
        <MissingInfoForm
          key={`session-missing-${analyzeOverride ? "override" : "session"}`}
          analyzeResult={analyzeResult}
          sessionId={sessionId}
          initialAnswers={initialAnswers}
        />
      )}
    </section>
  );
}
