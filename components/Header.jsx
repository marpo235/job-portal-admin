'use client';

import { supabase } from '@/lib/supabaseClient';

export default function Header({ user, onSignOut }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (onSignOut) onSignOut();
  };

  const initial = user?.email ? user.email.charAt(0).toUpperCase() : '?';
  const avatar = user?.user_metadata?.avatar_url;

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">STL</div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Job Portal Admin</h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {user && (
            <>
              {avatar ? (
                <img
                  src={avatar}
                  alt={user.email}
                  className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold border border-slate-200">
                  {initial}
                </div>
              )}
              <span className="hidden sm:inline text-sm font-medium text-slate-600 max-w-[200px] truncate">
                {user.email}
              </span>
            </>
          )}
          <button
            onClick={handleSignOut}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
