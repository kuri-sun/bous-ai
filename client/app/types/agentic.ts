export type AgenticSearchResult = {
  title: string;
  link: string;
  snippet?: string | null;
};

export type AgenticSearchContext = {
  query: string;
  scope: "city" | "prefecture";
  result?: AgenticSearchResult | null;
};

export type AgenticTurn = {
  kind: "question" | "proposal";
  content: string;
};

export type AgenticMessage = {
  role: "assistant" | "user";
  content: string;
};

export type AgenticState = {
  status: "idle" | "question" | "proposal" | "accepted" | "rejected";
  turn?: AgenticTurn | null;
  proposal?: string | null;
  history?: AgenticMessage[];
  search?: AgenticSearchContext | null;
};

export type AgenticConversationResponse = {
  agentic: AgenticState;
};

export type AgenticDecisionResponse = {
  agentic: AgenticState;
};
