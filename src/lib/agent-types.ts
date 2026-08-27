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
