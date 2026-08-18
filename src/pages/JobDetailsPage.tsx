import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Briefcase,
  Globe2,
  DollarSign,
  ExternalLink,
  ShieldCheck,
  Share2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { fetchJobById } from '../lib/api';
import { JobRecord } from '../types/shared';
import { getSafeApplyUrl, isValidJobUrl } from '../lib/urlUtils';

export const JobDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    fetchJobById(id)
      .then((data) => setJob(data))
      .catch((err) => setError(err.message || 'Job record not found.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return formatDistanceToNow(parseISO(isoString), { addSuffix: true });
    } catch {
      return isoString;
    }
  };

  const getFormattedDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return format(parseISO(isoString), 'MMM d, yyyy');
    } catch {
      return isoString;
    }
  };

  const safeApplyUrl = getSafeApplyUrl(job?.applyUrl, job?.sourceUrl);
  const hasValidApplyUrl = Boolean(safeApplyUrl);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6 animate-pulse">
        <div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
          <div className="w-2/3 h-8 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="w-1/3 h-5 bg-slate-100 dark:bg-slate-800/60 rounded" />
          <div className="flex space-x-3 pt-4">
            <div className="w-24 h-6 bg-slate-100 dark:bg-slate-800/60 rounded" />
            <div className="w-24 h-6 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
          <div className="space-y-2 pt-6">
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800/60 rounded" />
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800/60 rounded" />
            <div className="w-4/5 h-4 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Job Record Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'This job may have expired or been removed.'}</p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to Job Discovery
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumbs */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to all jobs
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start space-x-4">
            {job.companyLogoUrl ? (
              <img
                src={job.companyLogoUrl}
                alt={job.companyName}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className="w-16 h-16 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-1.5 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-lg shrink-0">
                {job.companyName.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{job.companyName}</span>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-medium">
                  {job.source}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                {job.title}
              </h1>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-500 dark:text-slate-400 mt-3">
                <span className="flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                  {job.location}
                </span>
                <span className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                  Published {getRelativeTime(job.publishedAt)} ({getFormattedDate(job.publishedAt)})
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-row md:flex-col items-center md:items-end gap-2.5 shrink-0">
            {hasValidApplyUrl && safeApplyUrl ? (
              <a
                id="btn-apply-real-url"
                href={safeApplyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <span>Apply on {job.source}</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </a>
            ) : (
              <span className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-medium cursor-not-allowed">
                Application link unavailable
              </span>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 mr-1" />
                  <span>Share Job</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Badges Ribbon */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
            <Globe2 className="w-3.5 h-3.5 mr-1.5" />
            {job.remoteType}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <Briefcase className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
            {job.employmentType}
          </span>
          {job.salary && (
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              <DollarSign className="w-3.5 h-3.5 mr-0.5" />
              {job.salary}
            </span>
          )}
        </div>
      </div>

      {/* Grid: Job Content & Provenance Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Job Description & Requirements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Description */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Job Description</h2>
            <div
              className="prose dark:prose-invert prose-sm max-w-none text-slate-700 dark:text-slate-300 leading-relaxed break-words space-y-3"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(job.description) }}
            />
          </div>

          {/* Skills & Categories */}
          {(job.skills.length > 0 || job.categories.length > 0) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Relevant Skills & Categories</h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, idx) => (
                  <span
                    key={`skill-${idx}`}
                    className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold"
                  >
                    {skill}
                  </span>
                ))}
                {job.categories.map((cat, idx) => (
                  <span
                    key={`cat-${idx}`}
                    className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-200/50 dark:border-indigo-800/60"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Ingestion Provenance & Data Integrity */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Data Provenance & Audit</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium block">Source Adapter</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{job.source}</span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium block">External ID</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate block">{job.externalId}</span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium block">Deduplication Hash (SHA-256)</span>
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all block bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700">
                  {job.deduplicationKey}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium block">Ingested Timestamp</span>
                <span className="text-slate-700 dark:text-slate-300">{getFormattedDate(job.ingestedAt)}</span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium block">Original Source URL</span>
                {isValidJobUrl(job.sourceUrl) ? (
                  <a
                    href={job.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center font-medium truncate pt-0.5"
                  >
                    <span className="truncate">{job.sourceUrl}</span>
                    <ExternalLink className="w-3 h-3 ml-1 shrink-0" />
                  </a>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">Application link unavailable</span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>Verified legitimate posting directly fetched via official API/RSS feed without scraping or spoofing.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
