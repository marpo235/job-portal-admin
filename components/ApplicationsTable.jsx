'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ApplicationsTable({ applications, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        <p className="mt-4 text-sm text-slate-500">Loading applications...</p>
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">No applications found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Age</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Gender</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Audio Sample</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {applications.map((app) => (
            <ApplicationRow key={app.id} app={app} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApplicationRow({ app }) {
  const [audioSrc, setAudioSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const getSignedUrl = async () => {
    const { data, error } = await supabase
      .storage
      .from('applicant-audio')
      .createSignedUrl(app.audio_file_path, 3600);

    if (error || !data?.signedUrl) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  const handlePlay = async () => {
    if (audioSrc || isLoading) return;
    setIsLoading(true);
    const url = await getSignedUrl();
    setIsLoading(false);
    if (url) setAudioSrc(url);
  };

  const handleDownload = async () => {
    const url = await getSignedUrl();
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = app.audio_file_path?.split('/').pop() || 'audio-sample';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <tr className="hover:bg-slate-50 transition">
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
        {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : '—'}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{app.full_name}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{app.email}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{app.age ?? '—'}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{app.gender ?? '—'}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 min-w-[220px]">
        <div className="space-y-2">
          <audio
            controls
            src={audioSrc}
            onPlay={handlePlay}
            className="w-full h-8"
            preload="none"
          />
          {isLoading && <p className="text-xs text-slate-500">Loading audio...</p>}
          <button
            onClick={handleDownload}
            className="inline-flex items-center rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition"
          >
            Download Audio
          </button>
        </div>
      </td>
    </tr>
  );
}
