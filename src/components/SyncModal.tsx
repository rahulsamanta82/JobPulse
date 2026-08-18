import React, { useState } from 'react';
import {
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import { triggerSync } from '../lib/api';
import { IngestionRun } from '../types/shared';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (runs: IngestionRun[]) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [simulateScenario, setSimulateScenario] = useState<string>('normal');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<{
    runs: IngestionRun[];
    totalInserted: number;
    totalDuplicates: number;
    totalErrors: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await triggerSync({
        sourceId: selectedSource,
        simulateScenario: selectedSource === 'sandbox' ? simulateScenario : undefined,
      });
      setResult(data);
      if (onSyncComplete) onSyncComplete(data.runs);
    } catch (err: any) {
      setError(err.message || 'Sync failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Trigger Ingestion Sync</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Live data pull from configured source adapters</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Source Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Select Target Source
            </label>
            <select
              id="sync-source-select"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 transition cursor-pointer"
            >
              <option value="all">⚡ All Sources (Adzuna, Remotive, WWR, Jobicy)</option>
              <option value="adzuna">Adzuna REST API (Primary Configured Source)</option>
              <option value="remotive">Remotive Public API (Remote Software)</option>
              <option value="weworkremotely">WeWorkRemotely RSS 2.0 Feed</option>
              <option value="jobicy">Jobicy Remote API (Public Remote Jobs)</option>
              <option value="sandbox">🧪 QA Resilience Sandbox (Edge-case Simulation)</option>
            </select>
          </div>

          {/* Sandbox Scenarios (Only if Sandbox is selected) */}
          {selectedSource === 'sandbox' && (
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2 text-xs">
              <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 font-semibold">
                <Sliders className="w-3.5 h-3.5" />
                <span>QA Resilience Simulation Scenario</span>
              </div>
              <select
                value={simulateScenario}
                onChange={(e) => setSimulateScenario(e.target.value)}
                disabled={isLoading}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-md text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="normal">Normal Ingestion (Valid Records)</option>
                <option value="rate_limit_429">Simulate HTTP 429 Rate Limit (Backoff & Circuit Breaker)</option>
                <option value="malformed_data">Simulate Malformed Records (Partial Failure & Error Capture)</option>
                <option value="duplicates">Simulate Duplicate Jobs (Deduplication Engine)</option>
                <option value="unavailable">Simulate 503 Server Down (Graceful Degradation)</option>
              </select>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-tight">
                Used to prove error recovery, duplicate filtering, and circuit-breaker safety in the assessment.
              </p>
            </div>
          )}

          {/* Execution Results Banner */}
          {result && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600 dark:text-emerald-400" />
                  Sync Execution Completed
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {result.runs.length} Source{result.runs.length === 1 ? '' : 's'} Processed
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase">Inserted</span>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{result.totalInserted}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase">Duplicates</span>
                  <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{result.totalDuplicates}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase">Errors / Rej</span>
                  <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{result.totalErrors}</div>
                </div>
              </div>

              {/* Run Summaries */}
              <div className="space-y-1.5 pt-1">
                {result.runs.map((run) => (
                  <div
                    key={run.id}
                    className="text-[11px] p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-1.5 truncate max-w-[280px]">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          run.status === 'SUCCESS'
                            ? 'bg-emerald-500'
                            : run.status === 'PARTIAL'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{run.source}:</span>
                      <span className="text-slate-500 dark:text-slate-400 truncate">{run.summaryMessage}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{run.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            {result ? 'Close' : 'Cancel'}
          </button>

          <button
            id="btn-execute-sync"
            type="button"
            onClick={handleStartSync}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-xs cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                <span>Synchronizing...</span>
              </>
            ) : (
              <>
                <span>Execute Ingestion</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
