import "./globals.css";

export const metadata = {
  title: "Vertex Chat",
  description: "FastAPI + Vertex AI chat",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-emerald-50 text-emerald-950 antialiased">
        <header className="border-b border-emerald-100 bg-white/90">
          <div className="flex w-full max-w-3xl items-center justify-between px-8 py-4">
            <span className="text-sm font-semibold text-emerald-900">
              防災マニュアル作成
            </span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
