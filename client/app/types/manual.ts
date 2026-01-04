export type FormField = {
  id: string;
  label: string;
  field_type: "text" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
};

export type FormSchema = {
  fields: FormField[];
};

export type AnalyzeResponse = {
  msg: string;
  form: FormSchema;
  extracted?: Record<string, unknown>;
  session_id?: string;
};
