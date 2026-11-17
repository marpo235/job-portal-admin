'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function isArchived(app) {
  return app.archived === 1 || app.archived === true;
}

function formatTimestamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatIpLocation(app) {
  const parts = [app.city, app.region, app.country].filter((p) => p && p !== 'Unknown');
  const loc = parts.length > 0 ? parts.join(', ') : '—';
  return app.ip_address && app.ip_address !== 'Blocked' ? `${loc} (${app.ip_address})` : loc;
}

function formatInterests(app) {
  const v = app.project_interests;
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [v]; } catch { return v ? [v] : []; } })() : [];
  return arr.map((s) => s.replace(/_/g, ' ')).join(', ') || '—';
}

function formatWeeklyHours(v) {
  return { under_2: '<2h', '2_5': '2–5h', '6_10': '6–10h', over_10: '>10h', varies: 'Varies' }[v] || v || '—';
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
  accent: '',
  country_of_origin: '',
  state_of_origin: '',
  country_of_residence: '',
  state_of_residence: '',
  native_languages: '',
  other_languages: '',
  device: '',
  home_studio: false,
  comments: '',
};

export default function TalentPoolTable({
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
  const [flagFilter, setFlagFilter] = useState('');
  const [networkFilter, setNetworkFilter] = useState('');
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
      map[app.id] = `talent${String(i + 1).padStart(3, '0')}`;
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
      allApplications.map((app) => (app.accent || '').trim()).filter(Boolean)
    );
    return [...set].sort();
  }, [allApplications]);

  const visibleApplications = useMemo(
    () =>
      allApplications.filter(
        (app) =>
          (view === 'active' ? !isArchived(app) : isArchived(app)) &&
          (!accentFilter || (app.accent || '') === accentFilter) &&
          (!flagFilter || (app.location_flag || '') === flagFilter) &&
          (!networkFilter || (app.network_flag || '') === networkFilter)
      ),
    [allApplications, view, accentFilter, flagFilter, networkFilter]
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
      accent: app.accent || '',
      country_of_origin: app.country_of_origin || '',
      state_of_origin: app.state_of_origin || '',
      country_of_residence: app.country_of_residence || '',
      state_of_residence: app.state_of_residence || '',
      native_languages: app.native_languages || '',
      other_languages: app.other_languages || '',
      device: app.device || '',
      home_studio: app.home_studio === true,
      comments: app.comments || '',
    });
  };

  const saveEdit = async () => {
    const updates = {
      ...editForm,
      age: editForm.age === '' ? null : Number(editForm.age),
    };
    const { error } = await supabase
      .from('talent_pool')
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
      .from('talent_pool')
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
      .from('talent_pool')
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
    if (app.location_flag === 'mismatch') return 'hsl(0 84% 95%)';
    if (app.network_flag === 'vpn_or_datacenter') return 'hsl(35 90% 92%)';
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
        <p className="mt-4 text-sm text-slate-500">Loading talent registrations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="talent-accent-filter" className="text-sm font-medium text-slate-600">
          Accent:
        </label>
        <select
          id="talent-accent-filter"
          value={accentFilter}
          onChange={(e) => setAccentFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:ring-blue-600"
        >
          <option value="">All accents</option>
          {accentOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <label htmlFor="talent-flag-filter" className="text-sm font-medium text-slate-600 ml-4">
          Location check:
        </label>
        <select
          id="talent-flag-filter"
          value={flagFilter}
          onChange={(e) => setFlagFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:ring-blue-600"
        >
          <option value="">All</option>
          <option value="match">Match</option>
          <option value="mismatch">Mismatch</option>
          <option value="unknown">Unknown</option>
        </select>
        <label htmlFor="talent-network-filter" className="text-sm font-medium text-slate-600 ml-4">
          Network:
        </label>
        <select
          id="talent-network-filter"
          value={networkFilter}
          onChange={(e) => setNetworkFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:ring-blue-600"
        >
          <option value="">All</option>
          <option value="vpn_or_datacenter">VPN / datacenter</option>
          <option value="clean">Clean</option>
          <option value="unknown">Unknown</option>
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
              ? 'No talent registrations found.'
              : 'No archived talent registrations found.'}
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
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted At</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Accent</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Age</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Origin</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Residence (claimed)</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">IP Location (detected)</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location Check</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Network</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Languages</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Interests</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Availability</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Device</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Studio</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Comments</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedApplications.map((app) => (
                  <TalentPoolRow
                    key={app.id}
                    app={app}
                    sampleId={sampleIdMap[app.id] || 'talent000'}
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
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Registration</h3>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Accent</label>
                  <input type="text" value={editForm.accent}
                    onChange={(e) => setEditForm((f) => ({ ...f, accent: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
                </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Native languages</label>
                  <input type="text" value={editForm.native_languages}
                    onChange={(e) => setEditForm((f) => ({ ...f, native_languages: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Other languages</label>
                  <input type="text" value={editForm.other_languages}
                    onChange={(e) => setEditForm((f) => ({ ...f, other_languages: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Device</label>
                <input type="text" value={editForm.device}
                  onChange={(e) => setEditForm((f) => ({ ...f, device: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comments</label>
                <textarea rows={3} value={editForm.comments}
                  onChange={(e) => setEditForm((f) => ({ ...f, comments: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:ring-blue-600" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={saveEdit}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TalentPoolRow({ app, sampleId, bgColor, isSelected, onToggle, onEdit, onArchive }) {
  const flag = app.location_flag || 'unknown';
  const flagStyle = {
    match: 'bg-green-100 text-green-800',
    mismatch: 'bg-red-100 text-red-800 font-semibold',
    unknown: 'bg-slate-100 text-slate-600',
  }[flag] || 'bg-slate-100 text-slate-600';

  return (
    <tr style={bgColor ? { backgroundColor: bgColor } : undefined} className="hover:bg-slate-50">
      <td className="px-2 py-3 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(app.id)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
        />
      </td>
      <td className="px-3 py-3 text-sm font-mono text-slate-700 whitespace-nowrap">{sampleId}</td>
      <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{formatTimestamp(app.submitted_at)}</td>
      <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">{app.accent || '—'}</td>
      <td className="px-3 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">{app.full_name || '—'}</td>
      <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{app.email || '—'}</td>
      <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{app.age ?? '—'}</td>
      <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">
        {[app.state_of_origin, app.country_of_origin].filter(Boolean).join(', ') || '—'}
      </td>
      <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">
        {[app.state_of_residence, app.country_of_residence].filter(Boolean).join(', ') || '—'}
      </td>
      <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{formatIpLocation(app)}</td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${flagStyle}`}>
          {flag === 'mismatch' ? '⚠ Mismatch' : flag}
        </span>
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${
          app.network_flag === 'vpn_or_datacenter'
            ? 'bg-amber-100 text-amber-800 font-semibold'
            : app.network_flag === 'clean'
            ? 'bg-green-100 text-green-800'
            : 'bg-slate-100 text-slate-600'
        }`} title={app.isp_org || ''}>
          {app.network_flag === 'vpn_or_datacenter' ? '⚠ VPN/DC' : app.network_flag || 'unknown'}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-slate-600">
        <div>{app.native_languages || '—'}</div>
        {app.other_languages && <div className="text-xs text-slate-500">also: {app.other_languages}</div>}
      </td>
      <td className="px-3 py-3 text-sm text-slate-600">{formatInterests(app)}</td>
      <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{formatWeeklyHours(app.weekly_hours)}</td>
      <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{app.device || '—'}</td>
      <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{app.home_studio ? 'Yes' : 'No'}</td>
      <td className="px-3 py-3 text-sm text-slate-600 max-w-[200px] truncate" title={app.comments || ''}>{app.comments || '—'}</td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        <button
          onClick={() => onEdit(app)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition mr-2"
        >
          Edit
        </button>
        <button
          onClick={() => onArchive(app)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          {isArchived(app) ? 'Unarchive' : 'Archive'}
        </button>
      </td>
    </tr>
  );
}
