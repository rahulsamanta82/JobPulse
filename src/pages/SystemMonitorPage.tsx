import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Shield,
  Layers,
  Terminal,
  Cpu,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fetchSources, fetchSystemHealth, fetchDetectionSurfaceAnalysis, triggerSync } from '../lib/api';
import { SourceHealth, IngestionRun } from '../types/shared';

export const SystemMonitorPage: React.FC = () => {
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [detectionSurface, setDetectionSurface] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedScenario, setSelectedScenario] = useState<string>('normal');
  const [syncFeedback, setSyncFeedback] = useState<{
    success: boolean;
    message: string;
    runs?: IngestionRun[];
  } | null>(null);

  const loadTelemetry = useCallback(async () => {
    try {
      const [srcs, health, detection] = await Promise.all([
        fetchSources(),
        fetchSystemHealth(),
        fetchDetectionSurfaceAnalysis(),
      ]);
      setSources(srcs);
      setHealthData(health);
      setDetectionSurface(detection);
    } catch (err: any) {
      console.error('Failed to load telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTelemetry();
    const interval = setInterval(loadTelemetry, 15000);
    return () => clearInterval(interval);
  }, [loadTelemetry]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await triggerSync({
        sourceId: selectedSource,
        simulateScenario: selectedSource === 'sandbox' ? selectedScenario : undefined,
      });

      setSyncFeedback({
        success: true,
        message: `Sync completed! Inserted ${res.totalInserted} new jobs, identified ${res.totalDuplicates} duplicates.`,
        runs: res.runs,
      });
      await loadTelemetry();
    } catch (err: any) {
      setSyncFeedback({
        success: false,
        message: err.message || 'Sync failed.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Infrastructure & Pipeline Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            System & Ingestion Health
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Real-time observability of source adapters, circuit-breaker states, database storage, and detection surface awareness.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/system/ingestion"
            className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
            <span>View Ingestion Logs</span>
          </Link>
          <button
            type="button"
            onClick={() => loadTelemetry()}
            className="inline-flex items-center px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Refresh telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Global Telemetry Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: System Status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center space-x-4 transition-colors">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              healthData?.systemStatus === 'HEALTHY'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : healthData?.systemStatus === 'DEGRADED'
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
            }`}
          >
            {healthData?.systemStatus === 'HEALTHY' ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : healthData?.systemStatus === 'DEGRADED' ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <XCircle className="w-6 h-6" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Pipeline Status</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">{healthData?.systemStatus || 'HEALTHY'}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {sources.filter((s) => s.status === 'HEALTHY').length} of {sources.length} sources online
            </span>
          </div>
        </div>

        {/* Metric 2: Active Database Storage */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center space-x-4 transition-colors">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            healthData?.database?.status === 'connected'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
          }`}>
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Database Storage</span>
              <span className={`w-1.5 h-1.5 rounded-full ${healthData?.database?.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {healthData?.database?.jobsCount ?? 0} <span className="text-xs font-normal text-slate-500">jobs</span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
              {healthData?.database?.type === 'MongoDB'
                ? healthData?.database?.status === 'connected'
                  ? `MongoDB Atlas (${healthData.database.databaseName || 'ACDYONJobPulse'})`
                  : `MongoDB Atlas (Reconnecting...)`
                : 'Embedded Store'}
            </span>
          </div>
        </div>

        {/* Metric 3: Scheduler Cadence */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center space-x-4 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Sync Cadence</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {healthData?.scheduler?.intervalMinutes || 60}m
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
              Scheduler Active
            </span>
          </div>
        </div>

        {/* Metric 4: Process Uptime */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center space-x-4 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Server Uptime</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {healthData?.system ? formatUptime(healthData.system.uptimeSeconds) : '0m'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Memory: {healthData?.system?.memoryUsageMb || 0} MB
            </span>
          </div>
        </div>
      </div>

      {/* Source Adapters Health Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Configured Source Adapters</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dynamic health tracking, response times, and failure isolation per adapter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sources.map((src, idx) => {
            const isHealthy = src.status === 'HEALTHY';
            const isDegraded = src.status === 'DEGRADED';
            const sourceKey = src.sourceId || (src as any).id || `source-${src.name || idx}-${idx}`;
            return (
              <div
                key={sourceKey}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        isHealthy
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60'
                          : isDegraded
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                      />
                      {src.status}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                      {src.type}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-2.5">{src.name}</h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">{src.endpoint}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500">Response Time:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{src.responseTimeMs}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500">Consecutive Failures:</span>
                    <span
                      className={`font-semibold ${
                        src.consecutiveFailures > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {src.consecutiveFailures}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500">Total Synced:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {src.totalJobsInserted} jobs
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500">Last Sync:</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {src.lastSuccessfulSync
                        ? formatDistanceToNow(parseISO(src.lastSuccessfulSync), { addSuffix: true })
                        : 'Pending'}
                    </span>
                  </div>

                  {src.lastError && (
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-100 dark:border-rose-800/60 text-[10px] text-rose-700 dark:text-rose-300 font-mono break-all mt-1">
                      {src.lastError}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Sync & Resilience Control Console */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Ingestion Control & Resilience Console</h2>
              <p className="text-xs text-slate-400">
                Trigger manual pulls or simulate edge cases (429 Rate Limits, Schema drift, Network errors).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Target Source Dropdown */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              disabled={isSyncing}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">⚡ All Sources (Adzuna, Remotive, WWR, Jobicy)</option>
              <option value="adzuna">Adzuna REST API</option>
              <option value="remotive">Remotive Public API</option>
              <option value="weworkremotely">WeWorkRemotely RSS</option>
              <option value="jobicy">Jobicy Remote API</option>
              <option value="sandbox">🧪 QA Resilience Sandbox</option>
            </select>

            {/* Sandbox Scenarios */}
            {selectedSource === 'sandbox' && (
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                disabled={isSyncing}
                className="bg-amber-950/80 border border-amber-600/50 text-amber-200 text-xs font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="normal">Normal Sandbox Data</option>
                <option value="rate_limit_429">Simulate HTTP 429 Rate Limit</option>
                <option value="malformed_data">Simulate Malformed Records</option>
                <option value="duplicates">Simulate Duplicate Jobs</option>
                <option value="unavailable">Simulate 503 Server Down</option>
              </select>
            )}

            {/* Execute Button */}
            <button
              id="btn-console-sync"
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 disabled:opacity-50 transition shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Executing Pipeline...' : 'Run Ingestion'}</span>
            </button>
          </div>
        </div>

        {/* Live Feedback Box */}
        {syncFeedback && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              syncFeedback.success
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2 font-semibold">
              {syncFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>{syncFeedback.message}</span>
            </div>

            {syncFeedback.runs && syncFeedback.runs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                {syncFeedback.runs.map((r, rIdx) => (
                  <div key={r.id || `run-${r.source || 'src'}-${rIdx}`} className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 font-mono text-[11px]">
                    <div className="flex justify-between text-slate-300">
                      <span>{r.source}</span>
                      <span className={r.status === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'}>{r.status}</span>
                    </div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      +{r.inserted} inserted | {r.duplicates} dups | {r.rejected} rej ({r.durationMs}ms)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detection Surface Awareness & Ethical Ingestion Architecture */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6 transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Detection Surface & Ethical Boundaries</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Assessment Analysis: Why automated clients get flagged and how JobPulse operates ethically.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {detectionSurface?.vectors?.map((vec: any, idx: number) => (
            <div key={`detection-vector-${vec.category || ''}-${idx}`} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">{vec.category}</span>
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/60">
                  Vector {idx + 1}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-medium">{vec.vector}</p>
              <div className="pt-1 text-[11px] space-y-1">
                <div className="text-rose-700 dark:text-rose-400">
                  <strong>Detection Mechanism:</strong> {vec.detectionMechanism}
                </div>
                <div className="text-emerald-800 dark:text-emerald-300">
                  <strong>JobPulse Architecture:</strong> {vec.mitigationInJobPulse}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
