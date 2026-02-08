import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Database types
export interface Repo {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  last_sha: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: number;
  repo_id: number;
  path: string;
  content: string;
  language: string;
  token_count: number;
  line_count: number;
  last_sha: string;
  created_at: string;
  updated_at: string;
}

export interface Symbol {
  id: number;
  file_id: number;
  name: string;
  kind: string;
  signature: string | null;
  start_line: number;
  end_line: number;
  token_count: number;
  parent_symbol: string | null;
  created_at: string;
}

// Token estimation
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Response envelope type
export interface ApiResponse<T = unknown> {
  _meta: {
    total_tokens: number;
    truncated: boolean;
    hint?: string;
  };
  data: T;
}

export function createResponse<T>(data: T, tokens: number, truncated = false, hint?: string): ApiResponse<T> {
  return {
    _meta: {
      total_tokens: tokens,
      truncated,
      hint,
    },
    data,
  };
}
