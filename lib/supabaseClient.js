import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn('Supabase URL or Anon Key is missing. Check your environment variables.');
  }
  // Use placeholder values during static build so createClient does not throw.
  supabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
  supabaseAnonKey = supabaseAnonKey || 'placeholder-anon-key';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
