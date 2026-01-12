type CenteredPageStateProps = {
  title: string;
  description?: string;
  tone?: "default" | "muted";
};

export function CenteredPageState({
  title,
  description,
  tone = "default",
}: CenteredPageStateProps) {
  const textClass = tone === "muted" ? "text-gray-700" : "text-gray-900";

  return (
    <section
      className={`flex h-full items-center justify-center bg-white ${textClass}`}
    >
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-gray-700">{description}</p>
        ) : null}
      </div>
    </section>
  );
}
