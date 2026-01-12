import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import type { ReactNode } from "react";

type FieldLabelProps = {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
};

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const textInputBase =
  "mt-2 w-full rounded-md border border-gray-200 p-3 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400";

const selectBase =
  "mt-2 w-full rounded-md border border-gray-200 bg-white p-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400";

export function FieldLabel({ htmlFor, required, children }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-gray-800"
    >
      {children}
      {required ? " *" : ""}
    </label>
  );
}

export function TextInput({ className = "", ...props }: TextInputProps) {
  return <input className={`${textInputBase} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={`${textInputBase} ${className}`}
      rows={rows}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectProps) {
  return <select className={`${selectBase} ${className}`} {...props} />;
}
