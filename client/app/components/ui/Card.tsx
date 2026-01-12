import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-md border border-gray-200 bg-white ${className}`.trim()}
    >
      {children}
    </div>
  );
}
