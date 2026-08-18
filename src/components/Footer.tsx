import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 px-4 sm:px-8 mt-auto text-xs text-slate-500 dark:text-slate-400 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <Logo size={22} />
          <span className="font-bold text-slate-800 dark:text-slate-200">JobPulse Ingestion Engine</span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">Acdyon</span>
        </div>

        <div className="flex items-center space-x-6">
          <Link to="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
            Job Discovery
          </Link>
          <Link to="/system" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
            System Telemetry
          </Link>
          <Link to="/system/ingestion" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
            Audit Trail
          </Link>
        </div>

        <div className="flex items-center space-x-2 text-slate-400 dark:text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Permitted API & ToS Compliant Ingestion</span>
        </div>
      </div>
    </footer>
  );
};
