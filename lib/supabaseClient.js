import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

if (!isValidHttpUrl(supabaseUrl) || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn('Supabase URL or Anon Key is missing or invalid. Check your environment variables.');
  }
  // Use placeholder values during static build so createClient does not throw.
  supabaseUrl = 'https://placeholder.supabase.co';
  supabaseAnonKey = 'placeholder-anon-key';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
