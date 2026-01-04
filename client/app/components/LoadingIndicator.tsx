type LoadingIndicatorProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-6 w-6 border-[3px]",
} as const;

export default function LoadingIndicator({
  label = "読み込み中...",
  size = "md",
  className = "",
}: LoadingIndicatorProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 text-emerald-700 ${className}`}
    >
      <span
        className={`inline-block rounded-full border-emerald-200 border-t-emerald-600 ${sizeMap[size]} animate-spin`}
        aria-hidden="true"
      />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
