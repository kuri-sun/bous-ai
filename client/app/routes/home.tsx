import { Link } from "react-router";
import { buttonClasses } from "../components/ui/Button";

export default function Home() {
  return (
    <section className="flex h-full items-center justify-center bg-white text-gray-900">
      <div className="w-full max-w-xl px-6 text-center">
        <h1 className="text-2xl font-semibold">防災マニュアルを作成</h1>
        <p className="mt-3 text-sm text-gray-700">
          メモ・議事録や見本PDFから、防災マニュアルPDFを作成します。
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/sessions/create" className={buttonClasses({ size: "lg" })}>
            新規作成を始める
          </Link>
        </div>
      </div>
    </section>
  );
}
