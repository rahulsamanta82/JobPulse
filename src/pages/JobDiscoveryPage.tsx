import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Radio,
  Loader2,
} from 'lucide-react';
import { fetchJobs, triggerSync } from '../lib/api';
import { JobRecord, JobQueryParams, PaginatedResult } from '../types/shared';
import { JobCard } from '../components/JobCard';
import { JobFilters } from '../components/JobFilters';
import { SkeletonCard } from '../components/SkeletonCard';
import { SyncModal } from '../components/SyncModal';

export const JobDiscoveryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL search params for bookmarkable state
  const [filters, setFilters] = useState<JobQueryParams>({
    search: searchParams.get('search') || '',
    location: searchParams.get('location') || '',
    remoteType: searchParams.get('remoteType') || 'all',
    employmentType: searchParams.get('employmentType') || 'all',
    source: searchParams.get('source') || 'all',
    sort: (searchParams.get('sort') as any) || 'newest',
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: 12,
  });

  const [jobData, setJobData] = useState<PaginatedResult<JobRecord>>({
    items: [],
    pagination: {
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  });

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSyncRunning, setIsSyncRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnce = useRef<boolean>(false);

  const isFilterActive = Boolean(
    filters.search ||
      filters.location ||
      (filters.remoteType && filters.remoteType !== 'all') ||
      (filters.employmentType && filters.employmentType !== 'all') ||
      (filters.source && filters.source !== 'all')
  );

  const loadJobs = useCallback(async (currentFilters: JobQueryParams) => {
    // Cancel any in-flight request to avoid race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!hasLoadedOnce.current) {
      setIsInitialLoading(true);
    } else {
      setIsSearching(true);
    }
    setError(null);

    try {
      const data = await fetchJobs(currentFilters);
      if (!controller.signal.aborted) {
        setJobData(data);
        hasLoadedOnce.current = true;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        setError(err.message || 'Failed to load jobs.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsInitialLoading(false);
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    loadJobs(filters);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filters, loadJobs]);

  const handleRunFirstSync = async () => {
    setIsSyncRunning(true);
    setError(null);
    try {
      await triggerSync({ sourceId: 'all' });
      await loadJobs(filters);
    } catch (err: any) {
      setError(err.message || 'Sync failed. Check source credentials in settings.');
    } finally {
      setIsSyncRunning(false);
    }
  };

  // Sync state back to URL params
  const handleFiltersChange = (newFilters: JobQueryParams) => {
    setFilters(newFilters);
    const params = new URLSearchParams();
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.location) params.set('location', newFilters.location);
    if (newFilters.remoteType && newFilters.remoteType !== 'all') params.set('remoteType', newFilters.remoteType);
    if (newFilters.employmentType && newFilters.employmentType !== 'all') params.set('employmentType', newFilters.employmentType);
    if (newFilters.source && newFilters.source !== 'all') params.set('source', newFilters.source);
    if (newFilters.sort && newFilters.sort !== 'newest') params.set('sort', newFilters.sort);
    if (newFilters.page && newFilters.page > 1) params.set('page', String(newFilters.page));
    setSearchParams(params, { replace: true });
  };

  const handleResetFilters = () => {
    handleFiltersChange({
      search: '',
      location: '',
      remoteType: 'all',
      employmentType: 'all',
      source: 'all',
      sort: 'newest',
      page: 1,
      limit: 12,
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > jobData.pagination.totalPages) return;
    handleFiltersChange({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Live Job Ingestion Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Job Discovery
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Continuously ingested from trusted public developer job boards with automated deduplication and schema normalization.
          </p>
        </div>

        {/* Sync Action */}
        <div className="flex items-center space-x-3">
          <button
            id="btn-discovery-sync"
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>SYNC NOW</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <JobFilters
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
        totalResults={jobData.pagination.total}
      />

      {/* Subtle Searching Indicator Bar */}
      {isSearching && (
        <div className="flex items-center justify-center space-x-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Updating search results...</span>
        </div>
      )}

      {/* Main Content Area */}
      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Unable to load jobs</h3>
          <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => loadJobs(filters)}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 text-xs font-bold text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry Request
          </button>
        </div>
      ) : isInitialLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={`initial-skeleton-${i}`} />
          ))}
        </div>
      ) : jobData.items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Briefcase className="w-7 h-7" />
          </div>
          {isFilterActive ? (
            <>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No jobs match your search filters</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Try adjusting or clearing your keywords and filter tags.
                </p>
              </div>
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Clear Filters
                </button>
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  SYNC NOW
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No jobs imported yet.</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Click 'SYNC NOW' to run the ingestion pipeline and fetch live job postings from Adzuna.
                </p>
              </div>
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  id="btn-run-first-sync"
                  type="button"
                  onClick={handleRunFirstSync}
                  disabled={isSyncRunning}
                  className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-60 transition shadow-xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncRunning ? 'animate-spin' : ''}`} />
                  <span>{isSyncRunning ? 'Synchronizing Adzuna...' : 'SYNC NOW'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Job Grid with stable cards */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 transition-opacity duration-150 ${isSearching ? 'opacity-70' : 'opacity-100'}`}>
            {jobData.items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {/* Pagination Controls */}
          {jobData.pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing page <strong className="text-slate-800 dark:text-slate-200">{jobData.pagination.page}</strong> of{' '}
                <strong className="text-slate-800 dark:text-slate-200">{jobData.pagination.totalPages}</strong> (
                {jobData.pagination.total} total jobs)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(jobData.pagination.page - 1)}
                  disabled={!jobData.pagination.hasPrev}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Previous
                </button>

                {/* Page Pill Indicators */}
                <div className="hidden sm:flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, jobData.pagination.totalPages) }).map((_, i) => {
                    const pageNum = i + 1;
                    const isActive = pageNum === jobData.pagination.page;
                    return (
                      <button
                        key={`page-${pageNum}`}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {jobData.pagination.totalPages > 5 && (
                    <span className="text-slate-400 dark:text-slate-500 px-1 text-xs">...</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handlePageChange(jobData.pagination.page + 1)}
                  disabled={!jobData.pagination.hasNext}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Sync Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={() => {
          loadJobs(filters);
        }}
      />
    </div>
  );
};
