import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  X,
  Terminal,
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { fetchIngestionRuns } from '../lib/api';
import { IngestionRun, PaginatedResult } from '../types/shared';

export const IngestionHistoryPage: React.FC = () => {
  const [runsData, setRunsData] = useState<PaginatedResult<IngestionRun>>({
    items: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedRun, setSelectedRun] = useState<IngestionRun | null>(null);

  const loadRuns = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const data = await fetchIngestionRuns(page, 20);
      setRunsData(data);
    } catch (err: any) {
      console.error('Failed to load runs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns(1);
  }, [loadRuns]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
            SUCCESS
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600 dark:text-amber-400" />
            PARTIAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
            <XCircle className="w-3 h-3 mr-1 text-rose-600 dark:text-rose-400" />
            FAILED
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <Link
            to="/system"
            className="inline-flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to System Monitor
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Ingestion Run History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete audit trail of all manual and scheduled synchronization executions with granular error logs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadRuns(runsData.pagination.page)}
          className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh Logs
        </button>
      </div>

      {/* Runs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest text-[10px]">
              <tr>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Trigger</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Fetched</th>
                <th className="py-3 px-4 text-right">Inserted</th>
                <th className="py-3 px-4 text-right">Duplicates</th>
                <th className="py-3 px-4 text-right">Rejected</th>
                <th className="py-3 px-4 text-right">Duration</th>
                <th className="py-3 px-4 text-center">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600 dark:text-indigo-400" />
                    Loading ingestion audit logs...
                  </td>
                </tr>
              ) : runsData.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    Waiting for the first recorded ingestion run.
                  </td>
                </tr>
              ) : (
                runsData.items.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-slate-200">
                        {format(parseISO(run.startedAt), 'HH:mm:ss')}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatDistanceToNow(parseISO(run.startedAt), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-200 whitespace-nowrap">
                      {run.source}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {run.trigger}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(run.status)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">{run.fetched}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      +{run.inserted}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">{run.duplicates}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                      {run.rejected > 0 ? <strong>{run.rejected}</strong> : 0}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {run.durationMs}ms
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedRun(run)}
                        className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition cursor-pointer"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {runsData.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Page {runsData.pagination.page} of {runsData.pagination.totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => loadRuns(runsData.pagination.page - 1)}
                disabled={!runsData.pagination.hasPrev}
                className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => loadRuns(runsData.pagination.page + 1)}
                disabled={!runsData.pagination.hasNext}
                className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Run Audit Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/60">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Ingestion Audit: {selectedRun.source} ({selectedRun.id})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Triggered via {selectedRun.trigger} at {format(parseISO(selectedRun.startedAt), 'PPpp')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                aria-label="Close audit"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Fetched</span>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-200">{selectedRun.fetched}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-800/60">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Inserted</span>
                  <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">+{selectedRun.inserted}</div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-950/60 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-800/60">
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-semibold">Duplicates</span>
                  <div className="text-base font-bold text-indigo-700 dark:text-indigo-300">{selectedRun.duplicates}</div>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/60 p-2.5 rounded-lg border border-rose-100 dark:border-rose-800/60">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">Rejected</span>
                  <div className="text-base font-bold text-rose-700 dark:text-rose-300">{selectedRun.rejected}</div>
                </div>
              </div>

              {/* Message */}
              {selectedRun.summaryMessage && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  <strong>Summary:</strong> {selectedRun.summaryMessage}
                </div>
              )}

              {/* Error Records Breakdown */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                  <span>Captured Error Records ({selectedRun.errors?.length || 0})</span>
                  {selectedRun.errors?.length === 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-medium flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Zero schema validation errors
                    </span>
                  )}
                </h4>

                {selectedRun.errors && selectedRun.errors.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedRun.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg text-rose-800 dark:text-rose-300 space-y-1"
                      >
                        <div className="flex items-center justify-between font-mono font-bold text-[11px]">
                          <span>[{err.code}]</span>
                          <span className="text-[10px] text-rose-500 dark:text-rose-400">{err.itemIdentifier || 'unidentified'}</span>
                        </div>
                        <p className="text-[11px]">{err.message}</p>
                        {err.rawSample && (
                          <pre className="p-1.5 bg-white dark:bg-slate-900 rounded border border-rose-100 dark:border-rose-800 text-[10px] text-slate-600 dark:text-slate-400 font-mono overflow-x-auto">
                            {err.rawSample}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center text-slate-400 dark:text-slate-500">
                    All processed records successfully normalized and deduplicated without errors.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
