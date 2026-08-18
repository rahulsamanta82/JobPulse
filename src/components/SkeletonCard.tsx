import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs animate-pulse flex flex-col justify-between min-h-[280px] transition-colors">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-1.5">
              <div className="w-24 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-32 h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          </div>
          <div className="w-16 h-5 bg-slate-100 dark:bg-slate-800 rounded-md" />
        </div>

        {/* Title */}
        <div className="mt-4 space-y-1.5">
          <div className="w-4/5 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="w-1/2 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>

        {/* Badges */}
        <div className="flex items-center space-x-2 mt-3">
          <div className="w-16 h-5 bg-slate-100 dark:bg-slate-800 rounded-md" />
          <div className="w-20 h-5 bg-slate-100 dark:bg-slate-800 rounded-md" />
        </div>

        {/* Snippet */}
        <div className="mt-3 space-y-1">
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded" />
          <div className="w-5/6 h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="w-20 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="w-16 h-7 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
    </div>
  );
};
