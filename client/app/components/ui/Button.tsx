import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

const variantClassMap: Record<ButtonVariant, string> = {
  primary: "bg-gray-900 text-white hover:bg-gray-800",
  secondary:
    "border border-gray-200 bg-white text-gray-800 hover:border-gray-300",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2 text-sm",
};

const baseClass =
  "inline-flex items-center justify-center rounded-md font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50";

// eslint-disable-next-line react-refresh/only-export-components
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: ButtonClassOptions = {}) {
  return [
    baseClass,
    variantClassMap[variant],
    sizeClassMap[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}
