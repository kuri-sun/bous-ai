import "./globals.css";
import Providers from "./providers";
import Sidebar from "./sidebar";

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
      <body className="overflow-hidden text-emerald-950 antialiased">
        <header className="h-16 border-b border-emerald-100 bg-white/90">
          <div className="flex h-full w-full max-w-6xl items-center justify-between px-4">
            <span className="font-semibold text-emerald-900">
              防災マニュアル作成
            </span>
          </div>
        </header>
        <div className="h-[calc(100vh-4rem)]">
          <Providers>
            <div className="grid h-full grid-cols-[240px_1fr]">
              <Sidebar />
              <main className="h-full overflow-y-auto">{children}</main>
            </div>
          </Providers>
        </div>
      </body>
    </html>
  );
}
