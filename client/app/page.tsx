import Link from "next/link";

export default function HomePage() {
  return (
    <section className="flex h-full items-center justify-center bg-white text-emerald-950">
      <div className="w-full max-w-xl px-6 text-center">
        <h1 className="text-2xl font-semibold">防災マニュアルを作成</h1>
        <p className="mt-3 text-sm text-emerald-700">
          メモ・議事録や見本PDFから不足情報を抽出し、防災マニュアルPDFを作成します。
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/sessions/create"
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            新規作成を始める
          </Link>
        </div>
      </div>
    </section>
  );
}
