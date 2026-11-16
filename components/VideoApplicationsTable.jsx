'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function getVideoFiles(app) {
  if (Array.isArray(app.video_files)) return app.video_files;
  if (typeof app.video_files === 'string') {
    try {
      const parsed = JSON.parse(app.video_files);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [app.video_files];
    }
  }
  if (typeof app.video_file_path === 'string') return [app.video_file_path];
  return [];
}

async function getSignedUrl(path) {
  const { data, error } = await supabase
    .storage
    .from('applicant-video')
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export default function VideoApplicationsTable({ applications, loading, onRefresh }) {
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const map = {};
      for (const app of applications) {
        for (const path of getVideoFiles(app)) {
          const url = await getSignedUrl(path);
          if (!cancelled) map[path] = url;
        }
      }
      if (!cancelled) setUrls(map);
    };
    if (applications.length) load();
    return () => { cancelled = true; };
  }, [applications]);

  if (loading) return <p className="text-slate-500">Loading video applications...</p>;
  if (!applications.length) return <p className="text-slate-500">No video applications yet.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="px-4 py-3 font-semibold">Email</th>
            <th className="px-4 py-3 font-semibold">Age</th>
            <th className="px-4 py-3 font-semibold">Gender</th>
            <th className="px-4 py-3 font-semibold">Origin</th>
            <th className="px-4 py-3 font-semibold">Residence</th>
            <th className="px-4 py-3 font-semibold">Studio</th>
            <th className="px-4 py-3 font-semibold">Submitted</th>
            <th className="px-4 py-3 font-semibold">Videos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {applications.map((app) => {
            const files = getVideoFiles(app);
            return (
              <tr key={app.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{app.full_name}</td>
                <td className="px-4 py-3 text-slate-600">{app.email}</td>
                <td className="px-4 py-3 text-slate-600">{app.age}</td>
                <td className="px-4 py-3 text-slate-600">{app.gender}</td>
                <td className="px-4 py-3 text-slate-600">{app.state_of_origin}, {app.country_of_origin}</td>
                <td className="px-4 py-3 text-slate-600">{app.state_of_residence}, {app.country_of_residence}</td>
                <td className="px-4 py-3 text-slate-600">{app.home_studio ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(app.submitted_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {files.map((path) => (
                      <a key={path} href={urls[path] || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                        {path}
                      </a>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-4 border-t border-slate-200">
        <button onClick={onRefresh} className="text-sm text-blue-600 hover:underline">Refresh</button>
      </div>
    </div>
  );
}
