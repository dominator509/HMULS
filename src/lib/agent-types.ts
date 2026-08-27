export type KeyScope = "read" | "write" | "operator";

export type AgentKey = {
  id: string;
  label: string;
  prefix: string;
  scope: KeyScope;
  lastUsedAt: string | null;
  createdAt: string;
  revoked: boolean;
};

export const PREVIEW_TOKEN = "she_preview_local_agent_key_do_not_use_live";
