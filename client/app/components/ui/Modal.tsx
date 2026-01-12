import type { ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
};

export function Modal({
  children,
  className = "",
  containerClassName = "w-full max-w-sm rounded-lg bg-white p-6 shadow-lg",
}: ModalProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 ${className}`}
    >
      <div className={containerClassName}>{children}</div>
    </div>
  );
}
