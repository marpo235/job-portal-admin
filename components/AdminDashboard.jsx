'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Header from './Header';
import Login from './Login';
import ApplicationsTable from './ApplicationsTable';
import ContactQueries from './ContactQueries';

const allowedAdminEmails = (process.env.NEXT_PUBLIC_ALLOWED_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [contactQueries, setContactQueries] = useState([]);
  const [search, setSearch] = useState('');
  const [recordingsView, setRecordingsView] = useState('active');
  const [activeSection, setActiveSection] = useState('recordings');
  const [accessDenied, setAccessDenied] = useState(false);

  const filteredApplications = useMemo(() => {
    const term = search.toLowerCase();
    return applications.filter(
      (app) =>
        (app.full_name?.toLowerCase() || '').includes(term) ||
        (app.email?.toLowerCase() || '').includes(term)
    );
  }, [search, applications]);

  const handleUpdateApplication = (id, updates) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, ...updates } : app))
    );
  };

  const handleDeleteContactOne = (id) => {
    setContactQueries((prev) => prev.filter((q) => q.id !== id));
  };

  const handleDeleteContactMany = (ids) => {
    setContactQueries((prev) => prev.filter((q) => !ids.includes(q.id)));
  };

  const sampleIdMap = useMemo(() => {
    const sorted = [...applications].sort((a, b) => {
      const ta = new Date(a.submitted_at || 0).getTime();
      const tb = new Date(b.submitted_at || 0).getTime();
      return ta - tb;
    });
    const map = {};
    sorted.forEach((app, index) => {
      map[app.id] = `sample${String(index + 1).padStart(3, '0')}`;
    });
    return map;
  }, [applications]);

  const fetchApplications = async () => {
    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .or('archived.eq.0,archived.is.null,archived.eq.1')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch applications:', error);
      setApplications([]);
    } else {
      setApplications(data || []);
    }
  };

  const fetchContactQueries = async () => {
    const { data, error } = await supabase
      .from('contact_queries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch contact queries:', error);
      setContactQueries([]);
    } else {
      setContactQueries(data || []);
    }
  };

  const checkUser = async (session) => {
    if (!session?.user) {
      setUser(null);
      setLoading(false);
      return;
    }

    const email = (session.user.email || '').toLowerCase();
    if (!allowedAdminEmails.includes(email)) {
      setAccessDenied(true);
      await supabase.auth.signOut();
      setUser(null);
      setLoading(false);
      return;
    }

    setUser(session.user);
    setAccessDenied(false);
    await fetchApplications();
    await fetchContactQueries();
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) await checkUser(session);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isMounted) await checkUser(session);
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const isArchived = (app) => app.archived === 1 || app.archived === true;
  const activeCount = applications.filter((app) => !isArchived(app)).length;
  const archivedCount = applications.length - activeCount;
  const contactCount = contactQueries.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border-l-4 border-red-500 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">
            Your email is not authorized to view this admin panel. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} onSignOut={() => setUser(null)} />
      <main className="flex-grow w-full max-w-[1800px] mx-auto px-4 sm:px-8 py-8">
        <nav className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-6">
          <button
            onClick={() => {
              setActiveSection('recordings');
              setRecordingsView('active');
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeSection === 'recordings' && recordingsView === 'active'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Recordings ({activeCount})
          </button>
          <button
            onClick={() => {
              setActiveSection('recordings');
              setRecordingsView('archived');
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeSection === 'recordings' && recordingsView === 'archived'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Archived Recordings ({archivedCount})
          </button>
          <button
            onClick={() => setActiveSection('contact')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeSection === 'contact'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Contact Queries ({contactCount})
          </button>
        </nav>

        {activeSection === 'recordings' ? (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {recordingsView === 'archived' ? 'Archived Recordings' : 'Recordings'}
              </h2>
              <p className="text-slate-600 text-sm">
                {recordingsView === 'archived'
                  ? 'View previously archived voice applications.'
                  : 'Review and listen to submitted voice samples.'}
              </p>
            </div>

            {recordingsView === 'active' && (
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:ring-opacity-20 transition"
                />
              </div>
            )}

            <ApplicationsTable
              applications={filteredApplications}
              loading={false}
              onUpdate={handleUpdateApplication}
              onRefresh={fetchApplications}
              sampleIdMap={sampleIdMap}
              view={recordingsView}
            />
          </>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Contact Queries</h2>
              <p className="text-slate-600 text-sm">Manage incoming contact form submissions.</p>
            </div>

            <ContactQueries
              queries={contactQueries}
              onRefresh={fetchContactQueries}
              onDeleteOne={handleDeleteContactOne}
              onDeleteMany={handleDeleteContactMany}
            />
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-8 text-center text-sm text-slate-500">
          &copy; 2026 Stealth Translations Ltd. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
