// Stored and RPC-transferred NIP-01 fields, without library verification caches.
export interface WikiEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}
