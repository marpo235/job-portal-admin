'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function isArchived(app) {
  return app.archived === 1 || app.archived === true;
}

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
  if (typeof app.video_file_path === 'string' && app.video_file_path)
    return [app.video_file_path];
  return [];
}

async function getVideoUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const { data, error } = await supabase
    .storage
    .from('applicant-video')
    .createSignedUrl(value, 3600);
  if (error || !data?.signedUrl) {
    console.error('Failed to create signed URL:', error);
    return null;
  }
  return data.signedUrl;
}

function formatTimestamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatLocation(app) {
  const parts = [app.city, app.region, app.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function stringToHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 360;
  }
  return h;
}

const EMPTY_EDIT = {
  full_name: '',
  email: '',
  age: '',
  gender: '',
  accent: '',
  country_of_origin: '',
  state_of_origin: '',
  country_of_residence: '',
  state_of_residence: '',
  home_studio: false,
};

export default function VideoApplicationsTable({
  applications,
  loading,
  onUpdate,
  onRefresh,
  view = 'active',
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [accentFilter, setAccentFilter] = useState('');
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const headerCheckboxRef = useRef(null);

  const allApplications = applications || [];

  const sampleIdMap = useMemo(() => {
    const sorted = [...allApplications].sort(
      (a, b) =>
        new Date(a.submitted_at || 0).getTime() -
        new Date(b.submitted_at || 0).getTime()
    );
    const map = {};
    sorted.forEach((app, i) => {
      map[app.id] = `video${String(i + 1).padStart(3, '0')}`;
    });
    return map;
  }, [allApplications]);

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
      if (key && !colors[key]) colors[key] = `hsl(${stringToHue(key)} 70% 94%)`;
    }
    return colors;
  }, [allApplications]);

  const accentOptions = useMemo(() => {
    const set = new Set(
      allApplications
        .map((app) => (app.accent || '').trim())
        .filter(Boolean)
    );
    return [...set].sort();
  }, [allApplications]);

  const visibleApplications = useMemo(
    () =>
      allApplications.filter(
        (app) =>
          (view === 'active' ? !isArchived(app) : isArchived(app)) &&
          (!accentFilter || (app.accent || '') === accentFilter)
      ),
    [allApplications, view, accentFilter]
  );

  const totalPages = Math.max(1, Math.ceil(visibleApplications.length / rowsPerPage));
  const pagedApplications = visibleApplications.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

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
      headerCheckboxRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) pagedApplications.forEach((app) => next.delete(app.id));
    else pagedApplications.forEach((app) => next.add(app.id));
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
      accent: app.accent || '',
      country_of_origin: app.country_of_origin || '',
      state_of_origin: app.state_of_origin || '',
      country_of_residence: app.country_of_residence || '',
      state_of_residence: app.state_of_residence || '',
      home_studio: app.home_studio === true,
    });
  };

  const saveEdit = async () => {
    const updates = {
      ...editForm,
      age: editForm.age === '' ? null : Number(editForm.age),
    };
    const { error } = await supabase
      .from('video_job_applications')
      .update(updates)
      .eq('id', editing);
    if (error) {
      alert(`Update failed: ${error.message}`);
      return;
    }
    onUpdate(editing, updates);
    setEditing(null);
    if (onRefresh) onRefresh();
  };

  const toggleArchive = async (app) => {
    const target = isArchived(app) ? { archived: 0 } : { archived: 1 };
    const { error } = await supabase
      .from('video_job_applications')
      .update(target)
      .eq('id', app.id);
    if (error) {
      alert(`Archive failed: ${error.message}`);
      return;
    }
    onUpdate(app.id, target);
    if (onRefresh) onRefresh();
  };

  const bulkArchive = async () => {
    if (selectedIds.size === 0) return;
    setBulkArchiving(true);
    const ids = Array.from(selectedIds);
    const target = view === 'archived' ? { archived: 0 } : { archived: 1 };
    const { error } = await supabase
      .from('video_job_applications')
      .update(target)
      .in('id', ids);
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
        <p className="mt-4 text-sm text-slate-500">Loading video applications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label htmlFor="accent-filter" className="text-sm font-medium text-slate-600">
          Accent:
        </label>
        <select
          id="accent-filter"
          value={accentFilter}
          onChange={(e) => setAccentFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:ring-blue-600"
        >
          <option value="">All accents</option>
          {accentOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
        </div>
      )}

      {visibleApplications.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">
            {view === 'active'
              ? 'No video recordings found.'
              : 'No archived video recordings found.'}
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
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sample ID</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted At</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Accent</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Age</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Gender</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Origin</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Residence</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Home Studio</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Video Recordings</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedApplications.map((app) => (
                  <VideoApplicationRow
                    key={app.id}
                    app={app}
                    sampleId={sampleIdMap[app.id] || 'video000'}
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
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Video Application</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                  <input type="number" value={editForm.age}
                    onChange={(e) => setEditForm((f) => ({ ...f, age: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                  <input type="text" value={editForm.gender}
                    onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Accent</label>
                <input type="text" value={editForm.accent}
                  onChange={(e) => setEditForm((f) => ({ ...f, accent: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Country of origin</label>
                  <input type="text" value={editForm.country_of_origin}
                    onChange={(e) => setEditForm((f) => ({ ...f, country_of_origin: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State of origin</label>
                  <input type="text" value={editForm.state_of_origin}
                    onChange={(e) => setEditForm((f) => ({ ...f, state_of_origin: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Country of residence</label>
                  <input type="text" value={editForm.country_of_residence}
                    onChange={(e) => setEditForm((f) => ({ ...f, country_of_residence: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State of residence</label>
                  <input type="text" value={editForm.state_of_residence}
                    onChange={(e) => setEditForm((f) => ({ ...f, state_of_residence: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Home studio</label>
                <select value={editForm.home_studio ? 'yes' : 'no'}
                  onChange={(e) => setEditForm((f) => ({ ...f, home_studio: e.target.value === 'yes' }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={saveEdit}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoApplicationRow({ app, sampleId, bgColor, isSelected, onToggle, onEdit, onArchive }) {
  const videoFiles = useMemo(() => getVideoFiles(app), [app]);
  const [signedUrls, setSignedUrls] = useState(() => videoFiles.map(() => null));
  const [loadingVideo, setLoadingVideo] = useState(true);
  const archived = isArchived(app);

  useEffect(() => {
    setLoadingVideo(true);
    if (videoFiles.length === 0) {
      setLoadingVideo(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const urls = await Promise.all(videoFiles.map(getVideoUrl));
      if (!cancelled) {
        setSignedUrls(urls);
        setLoadingVideo(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [videoFiles]);

  const handleDownload = async (index) => {
    const url = signedUrls[index] || (await getVideoUrl(videoFiles[index]));
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sampleId}_v${index + 1}.mp4`;
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
      <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold text-slate-700">{sampleId}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">{formatTimestamp(app.submitted_at)}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">{app.accent ?? '—'}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{app.full_name}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">{app.email}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">{formatLocation(app)}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">{app.age ?? '—'}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">{app.gender ?? '—'}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {[app.state_of_origin, app.country_of_origin].filter(Boolean).join(', ') || '—'}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {[app.state_of_residence, app.country_of_residence].filter(Boolean).join(', ') || '—'}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {app.home_studio ? 'Yes' : 'No'}
      </td>
      <td className="px-3 py-3">
        {loadingVideo ? (
          <span className="text-xs text-slate-400">Loading...</span>
        ) : videoFiles.length === 0 ? (
          <span className="text-xs text-slate-400">No files</span>
        ) : (
          <div className="flex flex-col gap-2">
            {videoFiles.map((path, i) => (
              <div key={path} className="flex items-center gap-2">
                {signedUrls[i] ? (
                  <video
                    src={signedUrls[i]}
                    controls
                    preload="none"
                    className="w-40 rounded bg-black"
                    controlsList="nodownload"
                  />
                ) : (
                  <span className="text-xs text-slate-400">Unavailable</span>
                )}
                <button
                  onClick={() => handleDownload(i)}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(app)}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Edit
          </button>
          <button
            onClick={() => onArchive(app)}
            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
          >
            {archived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      </td>
    </tr>
  );
}
