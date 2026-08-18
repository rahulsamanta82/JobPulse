import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { JobQueryParams } from '../types/shared';

interface JobFiltersProps {
  filters: JobQueryParams;
  onChange: (filters: JobQueryParams) => void;
  onReset: () => void;
  totalResults: number;
}

export const JobFilters: React.FC<JobFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalResults,
}) => {
  // Local input state for smooth typing without lag or full-page layout thrashing
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [locationInput, setLocationInput] = useState(filters.location || '');

  useEffect(() => {
    setSearchInput(filters.search || '');
  }, [filters.search]);

  useEffect(() => {
    setLocationInput(filters.location || '');
  }, [filters.location]);

  // Debounce search and location changes to parent (350ms)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (searchInput !== (filters.search || '') || locationInput !== (filters.location || '')) {
        onChange({
          ...filters,
          search: searchInput.trim(),
          location: locationInput.trim(),
          page: 1,
        });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, locationInput]);

  const hasActiveFilters = Boolean(
    searchInput ||
      locationInput ||
      (filters.remoteType && filters.remoteType !== 'all') ||
      (filters.employmentType && filters.employmentType !== 'all') ||
      (filters.source && filters.source !== 'all') ||
      (filters.category && filters.category !== 'all')
  );

  const handleDropdownChange = (field: keyof JobQueryParams, value: string) => {
    onChange({
      ...filters,
      search: searchInput.trim(),
      location: locationInput.trim(),
      [field]: value,
      page: 1,
    });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    onChange({
      ...filters,
      search: '',
      location: locationInput.trim(),
      page: 1,
    });
  };

  const handleClearLocation = () => {
    setLocationInput('');
    onChange({
      ...filters,
      search: searchInput.trim(),
      location: '',
      page: 1,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onChange({
        ...filters,
        search: searchInput.trim(),
        location: locationInput.trim(),
        page: 1,
      });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4 transition-colors">
      {/* Search Bar Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Title / Keywords Search */}
        <div className="relative md:col-span-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            id="input-search-query"
            type="text"
            placeholder="Search by job title, keywords, skills, or company..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search input"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Location Search */}
        <div className="relative md:col-span-4">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            id="input-search-location"
            type="text"
            placeholder="Filter location (e.g. London, Remote, United Kingdom)..."
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          {locationInput && (
            <button
              type="button"
              onClick={handleClearLocation}
              aria-label="Clear location input"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="md:col-span-2">
          <select
            id="select-sort-order"
            value={filters.sort || 'newest'}
            onChange={(e) => handleDropdownChange('sort', e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 font-medium focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="title_asc">Title (A-Z)</option>
            <option value="company_asc">Company (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Filter Facets Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px] flex items-center mr-1">
            <SlidersHorizontal className="w-3 h-3 mr-1" />
            Filters:
          </span>

          {/* Remote Facet */}
          <select
            id="filter-remote-type"
            value={filters.remoteType || 'all'}
            onChange={(e) => handleDropdownChange('remoteType', e.target.value)}
            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg border-0 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">All Remote Types</option>
            <option value="Remote">Remote Only</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On-site">On-site</option>
          </select>

          {/* Employment Type */}
          <select
            id="filter-employment-type"
            value={filters.employmentType || 'all'}
            onChange={(e) => handleDropdownChange('employmentType', e.target.value)}
            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg border-0 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">All Job Types</option>
            <option value="Full-time">Full-time</option>
            <option value="Contract">Contract / Freelance</option>
            <option value="Part-time">Part-time</option>
            <option value="Internship">Internship</option>
          </select>

          {/* Source Provenance */}
          <select
            id="filter-source"
            value={filters.source || 'all'}
            onChange={(e) => handleDropdownChange('source', e.target.value)}
            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg border-0 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">All Sources</option>
            <option value="Adzuna">Adzuna (Primary API)</option>
            <option value="Remotive">Remotive API</option>
            <option value="WeWorkRemotely">WeWorkRemotely RSS</option>
            <option value="Jobicy">Jobicy Remote API</option>
            <option value="Sandbox">QA Resilience Sandbox</option>
          </select>
        </div>

        {/* Right Status & Reset */}
        <div className="flex items-center space-x-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Found <strong className="text-slate-900 dark:text-white font-bold">{totalResults}</strong> matching job{totalResults === 1 ? '' : 's'}
          </span>

          {hasActiveFilters && (
            <button
              id="btn-reset-filters"
              type="button"
              onClick={onReset}
              className="inline-flex items-center px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition font-medium cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
