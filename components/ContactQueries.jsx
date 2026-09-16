'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function formatTimestamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getSubject(query) {
  return query.subject || query.interest || '—';
}

function getDate(query) {
  return query.created_at || query.submitted_at;
}

export default function ContactQueries({
  queries,
  onRefresh,
  onDeleteOne,
  onDeleteMany,
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const headerCheckboxRef = useRef(null);

  const allQueries = queries || [];

  const filteredQueries = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return allQueries;
    return allQueries.filter((q) => {
      const text = [
        q.full_name,
        q.email,
        getSubject(q),
        q.message,
      ]
        .join(' ')
        .toLowerCase();
      return text.includes(term);
    });
  }, [search, allQueries]);

  const totalPages = Math.max(1, Math.ceil(filteredQueries.length / rowsPerPage));
  const pagedQueries = filteredQueries.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const allPageSelected =
    pagedQueries.length > 0 &&
    pagedQueries.every((q) => selectedIds.has(q.id));
  const somePageSelected = pagedQueries.some((q) => selectedIds.has(q.id));

  useEffect(() => {
    setPage(1);
  }, [search, rowsPerPage, allQueries.length]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [search]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate =
        somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pagedQueries.forEach((q) => next.delete(q.id));
    } else {
      pagedQueries.forEach((q) => next.add(q.id));
    }
    setSelectedIds(next);
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const confirmSingleDelete = (id) => {
    setConfirmDelete({ type: 'single', ids: [id] });
  };

  const confirmBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmDelete({ type: 'bulk', ids: Array.from(selectedIds) });
  };

  const handleConfirmedDelete = async () => {
    if (!confirmDelete) return;
    const ids = confirmDelete.ids;

    if (confirmDelete.type === 'single') {
      const id = ids[0];
      onDeleteOne(id);
      console.log('Deleting contact query', id);
      const { data, error } = await supabase
        .from('contact_queries')
        .delete()
        .eq('id', id)
        .select();
      console.log('Supabase single delete result:', { data, error });
      if (error) {
        alert(`Delete failed: ${error.message}`);
      }
    } else {
      onDeleteMany(ids);
      setBulkDeleting(true);
      console.log('Bulk deleting contact queries', ids);
      const { data, error } = await supabase
        .from('contact_queries')
        .delete()
        .in('id', ids)
        .select();
      console.log('Supabase bulk delete result:', { data, error });
      if (error) {
        alert(`Bulk delete failed: ${error.message}`);
      }
      setBulkDeleting(false);
      setSelectedIds(new Set());
    }

    setConfirmDelete(null);
    if (onRefresh) onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search by name, email, subject, or message..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:ring-opacity-20 transition"
        />

        {selectedIds.size > 0 && (
          <button
            onClick={confirmBulkDelete}
            disabled={bulkDeleting}
            className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {bulkDeleting ? 'Deleting...' : `Bulk Delete (${selectedIds.size})`}
          </button>
        )}
      </div>

      {filteredQueries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">No contact queries found.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-3 py-3 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Submitted At
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Email Address
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Subject / Interest
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedQueries.map((q) => (
                  <QueryRow
                    key={q.id}
                    query={q}
                    isSelected={selectedIds.has(q.id)}
                    onToggle={toggleSelect}
                    onDelete={confirmSingleDelete}
                    onView={setViewing}
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

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Confirm Deletion
            </h3>
            <p className="text-slate-600 text-sm mb-6">
              {confirmDelete.type === 'single'
                ? 'Are you sure you want to delete this contact query?'
                : `Are you sure you want to delete ${confirmDelete.ids.length} selected contact queries?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedDelete}
                disabled={bulkDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition"
              >
                {bulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Full Message
              </h3>
              <button
                onClick={() => setViewing(null)}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                <span className="font-medium">From:</span>{' '}
                {viewing.full_name || '—'} ({viewing.email || '—'})
              </p>
              <p>
                <span className="font-medium">Subject / Interest:</span>{' '}
                {getSubject(viewing)}
              </p>
              <p>
                <span className="font-medium">Submitted At:</span>{' '}
                {formatTimestamp(getDate(viewing))}
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 whitespace-pre-wrap">
                {viewing.message || 'No message provided.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QueryRow({ query, isSelected, onToggle, onDelete, onView }) {
  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(query.id)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
        />
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {formatTimestamp(getDate(query))}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
        {query.full_name || '—'}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {query.email || '—'}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        {getSubject(query)}
      </td>
      <td className="px-3 py-3 text-sm text-slate-600 max-w-[240px]">
        <div className="flex items-center gap-2">
          <span className="truncate">
            {query.message || '—'}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
        <div className="flex gap-2">
          <button
            onClick={() => onView(query)}
            className="inline-flex items-center rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 transition"
          >
            View
          </button>
          <button
            onClick={() => onDelete(query.id)}
            className="inline-flex items-center rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
