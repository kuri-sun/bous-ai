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
      <body>
        <div className="background" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
