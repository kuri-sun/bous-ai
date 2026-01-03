"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  InputAnalyzeForm,
  MissingInfoForm,
  type AnalyzeResponse,
} from "../../components/manual-forms";

export default function CreateSessionPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(
    null,
  );
  const [sessionId, setSessionId] = useState<string | null>(null);

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

  const handleAnalyzed = (data: AnalyzeResponse) => {
    setAnalyzeResult(data);
    setSessionId(data.session_id ?? null);
    setStep(2);
    if (data.session_id) {
      router.push(`/sessions/${data.session_id}`);
    }
  };

  return (
    <section className="bg-white p-8 text-emerald-950">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">
          {step === 1 ? "入力と解析" : "不足情報入力"}
        </h2>
      </header>

      {step === 1 ? (
        <InputAnalyzeForm
          key="create-analyze"
          sampleMemo={sampleMemo}
          onAnalyzed={handleAnalyzed}
        />
      ) : (
        <MissingInfoForm
          key={analyzeResult ? "create-missing" : "create-empty"}
          analyzeResult={analyzeResult}
          sessionId={sessionId}
        />
      )}
    </section>
  );
}
