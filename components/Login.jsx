'use client';

import { supabase } from '@/lib/supabaseClient';

export default function Login() {
  const handleLogin = async () => {
    const redirectTo = `${window.location.origin}/job-portal-admin`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    if (error) {
      console.error('Login error:', error);
      alert('Google sign-in failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 mb-4 text-xl font-bold">A</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Job Portal Admin</h1>
        <p className="text-slate-600 mb-6">Sign in with your Google account to review applications.</p>
        <button
          onClick={handleLogin}
          className="w-full rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800 focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition"
        >
          Sign in with Google
        </button>
        <p className="text-xs text-slate-500 mt-4">Only authorized email addresses can access this panel.</p>
      </div>
    </div>
  );
}
