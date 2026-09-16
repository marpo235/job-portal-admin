'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import JSZip from 'jszip';

function isArchived(app) {
  return app.archived === 1 || app.archived === true;
}

function getAudioFiles(app) {
  if (Array.isArray(app.audio_urls)) return app.audio_urls;
  if (Array.isArray(app.audio_files)) return app.audio_files;
  if (Array.isArray(app.audio_paths)) return app.audio_paths;

  if (typeof app.audio_urls === 'string') return [app.audio_urls];

  if (typeof app.audio_files === 'string') {
    try {
      const parsed = JSON.parse(app.audio_files);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') return [parsed];
    } catch {
      // fall through to single value
    }
    return [app.audio_files];
  }

  if (typeof app.audio_file_path === 'string') return [app.audio_file_path];
  if (app.audio_file_path) return [app.audio_file_path];
  return [];
}

async function getAudioUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;

  const { data, error } = await supabase
    .storage
    .from('applicant-audio')
    .createSignedUrl(value, 3600);

  if (error || !data?.signedUrl) {
    console.error('Failed to create signed URL:', error);
    return null;
  }
  return data.signedUrl;
}

function getAudioExtension(value) {
  if (!value || typeof value !== 'string') return '.mp3';
  const withoutQuery = value.split('?')[0].split('#')[0];
  const ext = withoutQuery.split('.').pop() || '';
  if (ext && /^[a-z0-9]+$/i.test(ext) && ext.length <= 6) {
    return `.${ext.toLowerCase()}`;
  }
  return '.mp3';
}

function getAudioFileName(sampleId, index, value) {
  const extension = getAudioExtension(value);
  return `${sampleId}_ch${index + 1}${extension}`;
}

function formatTimestamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatLocation(app) {
  const parts = [app.city, app.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function stringToHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 360;
  }
  return h;
}

export default function ApplicationsTable({
  applications,
  loading,
  onUpdate,
  onRefresh,
  sampleIdMap,
}) {
  const [view, setView] = useState('active');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    age: '',
    gender: '',
  });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const headerCheckboxRef = useRef(null);

  const allApplications = applications || [];

  const duplicateColors = useMemo(() => {
    const emailCounts = {};
    const nameCounts = {};

    for (const app of allApplications) {
      const email = (app.email || '').toLowerCase().trim();
      const name = (app.full_name || '').toLowerCase().trim();
      if (email) emailCounts[email] = (emailCounts[email] || 0) + 1;
      if (name) nameCounts[name] = (nameCounts[name] || 0) + 1;
    }

    const colors = {};
    for (const app of allApplications) {
      const email = (app.email || '').toLowerCase().trim();
      const name = (app.full_name || '').toLowerCase().trim();
      let key = null;
      if (email && emailCounts[email] > 1) key = email;
      else if (name && nameCounts[name] > 1) key = name;
      if (key && !colors[key]) {
        colors[key] = `hsl(${stringToHue(key)} 70% 94%)`;
      }
    }
    return colors;
  }, [allApplications]);

  const visibleApplications = useMemo(() => {
    return allApplications.filter((app) =>
      view === 'active' ? !isArchived(app) : isArchived(app)
    );
  }, [allApplications, view]);

  const totalPages = Math.max(1, Math.ceil(visibleApplications.length / rowsPerPage));
  const pagedApplications = visibleApplications.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const activeCount = allApplications.filter((app) => !isArchived(app)).length;
  const archivedCount = allApplications.length - activeCount;

  const allPageSelected =
    pagedApplications.length > 0 &&
    pagedApplications.every((app) => selectedIds.has(app.id));
  const somePageSelected = pagedApplications.some((app) => selectedIds.has(app.id));

  useEffect(() => {
    setPage(1);
  }, [view, rowsPerPage, allApplications.length]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [view]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate =
        somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pagedApplications.forEach((app) => next.delete(app.id));
    } else {
      pagedApplications.forEach((app) => next.add(app.id));
    }
    setSelectedIds(next);
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const openEdit = (app) => {
    setEditing(app.id);
    setEditForm({
      full_name: app.full_name || '',
      email: app.email || '',
      age: app.age ?? '',
      gender: app.gender || '',
    });
  };

  const saveEdit = async () => {
    const updates = {
      full_name: editForm.full_name,
      email: editForm.email,
      age: editForm.age === '' ? null : String(editForm.age),
      gender: editForm.gender,
    };

    console.log('Saving edits for', editing, updates);
    const { data, error } = await supabase
      .from('job_applications')
      .update(updates)
      .eq('id', editing)
      .select();
    console.log('Supabase edit result:', { data, error });

    if (error) {
      alert(`Update failed: ${error.message}`);
      return;
    }

    onUpdate(editing, updates);
    setEditing(null);
    if (onRefresh) onRefresh();
  };

  const toggleArchive = async (app) => {
    const currentlyArchived = isArchived(app);
    const target = currentlyArchived
      ? { archived: 0 }
      : { archived: 1 };

    console.log(
      currentlyArchived ? 'Unarchiving' : 'Archiving',
      app.id,
      target
    );
    const { data, error } = await supabase
      .from('job_applications')
      .update(target)
      .eq('id', app.id)
      .select();
    console.log('Supabase toggle archive result:', { data, error });

    if (error) {
      alert(`${currentlyArchived ? 'Unarchive' : 'Archive'} failed: ${error.message}`);
      return;
    }

    onUpdate(app.id, target);
    if (onRefresh) onRefresh();
  };

  const bulkArchive = async () => {
    if (selectedIds.size === 0) return;
    setBulkArchiving(true);

    const ids = Array.from(selectedIds);
    const target =
      view === 'archived'
        ? { archived: 0 }
        : { archived: 1 };

    console.log('Bulk toggling archive for', ids, target);
    const { data, error } = await supabase
      .from('job_applications')
      .update(target)
      .in('id', ids)
      .select();
    console.log('Supabase bulk archive result:', { data, error });

    if (error) {
      alert(`Bulk action failed: ${error.message}`);
      setBulkArchiving(false);
      return;
    }

    ids.forEach((id) => onUpdate(id, target));
    setSelectedIds(new Set());
    if (onRefresh) onRefresh();
    setBulkArchiving(false);
  };

  const bulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);

    try {
      const zip = new JSZip();
      const selectedApps = allApplications.filter((app) =>
        selectedIds.has(app.id)
      );

      for (const app of selectedApps) {
        const audioFiles = getAudioFiles(app);
        const sampleId = sampleIdMap?.[app.id] || 'sample000';
        for (let i = 0; i < audioFiles.length; i++) {
          const value = audioFiles[i];
          const url = await getAudioUrl(value);
          if (!url) continue;

          const filename = getAudioFileName(sampleId, i, value);
          const res = await fetch(url);
          if (!res.ok) continue;

          const blob = await res.blob();
          zip.file(filename, blob);
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `selected-audio-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error('Bulk download failed:', e);
      alert('Bulk download failed.');
    } finally {
      setBulkDownloading(false);
    }
  };

  const getRowColor = (app) => {
    const email = (app.email || '').toLowerCase().trim();
    const name = (app.full_name || '').toLowerCase().trim();
    if (duplicateColors[email]) return duplicateColors[email];
    if (duplicateColors[name]) return duplicateColors[name];
    return undefined;
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        <p className="mt-4 text-sm text-slate-500">Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <nav className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setView('active')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              view === 'active'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Recordings ({activeCount})
          </button>
          <button
            onClick={() => setView('archived')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              view === 'archived'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Archived Recordings ({archivedCount})
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={bulkArchive}
              disabled={bulkArchiving}
              className="inline-flex items-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {bulkArchiving
                ? 'Updating...'
                : view === 'archived'
                ? 'Bulk Unarchive'
                : 'Bulk Archive'}
            </button>
            <button
              onClick={bulkDownload}
              disabled={bulkDownloading}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {bulkDownloading
                ? 'Preparing zip...'
                : `Download Selected Audio (${selectedIds.size})`}
            </button>
          </div>
        )}
      </nav>

      {visibleApplications.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">
            {view === 'active'
              ? 'No recordings found.'
              : 'No archived recordings found.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-2 py-3 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Sample ID
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Submitted At
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Audio Recordings
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedApplications.map((app) => (
                  <ApplicationRow
                    key={app.id}
                    app={app}
                    sampleId={sampleIdMap?.[app.id] || 'sample000'}
                    bgColor={getRowColor(app)}
                    isSelected={selectedIds.has(app.id)}
                    onToggle={toggleSelect}
                    onEdit={openEdit}
                    onArchive={toggleArchive}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-blue-600 focus:ring-blue-600"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Edit Application
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    value={editForm.age}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, age: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Gender
                  </label>
                  <input
                    type="text"
                    value={editForm.gender}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, gender: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationRow({ app, sampleId, bgColor, isSelected, onToggle, onEdit, onArchive }) {
  const audioFiles = useMemo(() => getAudioFiles(app), [app]);
  const [signedUrls, setSignedUrls] = useState(() =>
    audioFiles.map(() => null)
  );
  const [loadingAudio, setLoadingAudio] = useState(true);
  const archived = isArchived(app);

  useEffect(() => {
    setLoadingAudio(true);
    if (audioFiles.length === 0) {
      setLoadingAudio(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const urls = await Promise.all(audioFiles.map(getAudioUrl));
      if (!cancelled) setSignedUrls(urls);
      if (!cancelled) setLoadingAudio(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [audioFiles]);

  const handleDownload = async (index) => {
    const url = signedUrls[index] || (await getAudioUrl(audioFiles[index]));
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = getAudioFileName(sampleId, index, audioFiles[index]);
    a.click();
  };

  return (
    <tr
      style={bgColor ? { backgroundColor: bgColor } : undefined}
      className="hover:bg-slate-50/70 transition"
    >
      <td className="px-2 py-4 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(app.id)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
        />
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold text-slate-700">
        {sampleId}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {formatTimestamp(app.submitted_at)}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
        {app.full_name}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {app.email}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {formatLocation(app)}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {app.age ?? '—'}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {app.gender ?? '—'}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600 min-w-[260px]">
        {loadingAudio ? (
          <p className="text-xs text-slate-500">Loading audio...</p>
        ) : audioFiles.length === 0 ? (
          <p className="text-xs text-slate-500">No audio files.</p>
        ) : (
          <div className="space-y-2">
            {audioFiles.map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <audio
                  controls
                  src={signedUrls[index] || undefined}
                  className="w-full h-8"
                  preload="none"
                />
                {signedUrls[index] ? (
                  <button
                    onClick={() => handleDownload(index)}
                    className="inline-flex items-center rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    Download
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    Unavailable
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(app)}
            className="inline-flex items-center rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 transition"
          >
            Edit
          </button>
          <button
            onClick={() => onArchive(app)}
            className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium text-white transition ${
              archived
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            {archived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      </td>
    </tr>
  );
}
