import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Clock,
  ExternalLink,
  Globe2,
  DollarSign,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { JobRecord } from '../types/shared';
import { getSafeApplyUrl } from '../lib/urlUtils';

interface JobCardProps {
  job: JobRecord;
}

export const JobCard: React.FC<JobCardProps> = ({ job }) => {
  const [imgError, setImgError] = useState(false);

  const getRelativeTime = (isoString: string) => {
    try {
      return formatDistanceToNow(parseISO(isoString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const getSourceBadgeColor = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes('adzuna')) return 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border-cyan-200/70 dark:border-cyan-800/60';
    if (s.includes('remotive')) return 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60';
    if (s.includes('weworkremotely')) return 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/60';
    if (s.includes('jobicy')) return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60';
    if (s.includes('sandbox')) return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  const getInitials = (name: string) => {
    if (!name) return 'JB';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const safeApplyUrl = getSafeApplyUrl(job.applyUrl, job.sourceUrl);
  const hasValidApplyUrl = Boolean(safeApplyUrl);

  return (
    <div
      id={`job-card-${job.id}`}
      className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all flex flex-col justify-between min-h-[280px]"
    >
      <div>
        {/* Top Meta Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center space-x-3 min-w-0">
            {job.companyLogoUrl && !imgError ? (
              <img
                src={job.companyLogoUrl}
                alt={job.companyName}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-10 h-10 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-1 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs tracking-wider shrink-0">
                {getInitials(job.companyName)}
              </div>
            )}
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {job.companyName}
              </h4>
              <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-0.5 space-x-3">
                <span className="flex items-center truncate">
                  <MapPin className="w-3 h-3 mr-1 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="truncate max-w-[130px] sm:max-w-[170px]">{job.location}</span>
                </span>
                <span className="flex items-center text-slate-400 dark:text-slate-500 shrink-0">
                  <Clock className="w-3 h-3 mr-1 shrink-0" />
                  {getRelativeTime(job.publishedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Source Tag */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getSourceBadgeColor(
              job.source
            )} whitespace-nowrap shrink-0`}
          >
            {job.source}
          </span>
        </div>

        {/* Job Title */}
        <Link to={`/jobs/${job.id}`} className="block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
            {job.title}
          </h3>
        </Link>

        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/60">
            <Globe2 className="w-3 h-3 mr-1" />
            {job.remoteType}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
            <Briefcase className="w-3 h-3 mr-1 text-slate-500 dark:text-slate-400" />
            {job.employmentType}
          </span>
          {job.salary && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/60">
              <DollarSign className="w-3 h-3 mr-0.5" />
              {job.salary}
            </span>
          )}
        </div>

        {/* Description Snippet */}
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
          {job.descriptionSnippet}
        </p>

        {/* Skills Tag Pills */}
        {job.skills && job.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {job.skills.slice(0, 4).map((skill, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[11px] font-medium border border-slate-200/60 dark:border-slate-700"
              >
                {skill}
              </span>
            ))}
            {job.skills.length > 4 && (
              <span className="px-1.5 py-0.5 text-slate-400 dark:text-slate-500 text-[10px]">
                +{job.skills.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <Link
          to={`/jobs/${job.id}`}
          className="inline-flex items-center text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          View Details
          <ChevronRight className="w-3.5 h-3.5 ml-1 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* Real Apply External Link (Actual source redirect) */}
        {hasValidApplyUrl && safeApplyUrl ? (
          <a
            href={safeApplyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <span>Apply</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        ) : (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed">
            <AlertCircle className="w-3 h-3 mr-1" />
            Link Unavailable
          </span>
        )}
      </div>
    </div>
  );
};
