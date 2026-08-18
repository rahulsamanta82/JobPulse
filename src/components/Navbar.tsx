import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  Layers,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react';
import { fetchSystemHealth } from '../lib/api';
import { useTheme } from '../lib/theme';
import { Logo } from './Logo';

interface NavbarProps {
  onOpenSyncModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSyncModal }) => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [healthStatus, setHealthStatus] = useState<'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'>('HEALTHY');
  const [jobsCount, setJobsCount] = useState<number>(0);

  const checkHealth = async () => {
    try {
      const data = await fetchSystemHealth();
      setHealthStatus(data.systemStatus || 'HEALTHY');
      setJobsCount(data.database?.jobsCount || 0);
    } catch {
      setHealthStatus('DEGRADED');
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { to: '/', label: 'Discovery', icon: Briefcase },
    { to: '/system', label: 'System Monitor', icon: Activity },
    { to: '/system/ingestion', label: 'Audit Trail', icon: Layers },
  ];

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 shrink-0 transition-colors">
      <div className="flex items-center space-x-6 sm:space-x-8">
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center space-x-2.5 group">
          <Logo size={32} />
          <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            JobPulse<span className="text-indigo-600 dark:text-indigo-400 font-black">.</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-6 text-sm font-medium">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`transition-colors py-5 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-600 dark:border-indigo-400 translate-y-[1px]'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        {/* Status Pill Badge */}
        <Link
          to="/system"
          className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-full border transition-colors ${
            healthStatus === 'HEALTHY'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400'
              : healthStatus === 'DEGRADED'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400'
          }`}
          title="Click to view system status"
        >
          <div
            className={`w-2 h-2 rounded-full ${
              healthStatus === 'HEALTHY'
                ? 'bg-emerald-500 animate-pulse'
                : healthStatus === 'DEGRADED'
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
            {healthStatus === 'HEALTHY' ? `${jobsCount} Ingested` : healthStatus}
          </span>
        </Link>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Manual Sync CTA */}
        {onOpenSyncModal && (
          <button
            id="btn-navbar-sync"
            type="button"
            onClick={onOpenSyncModal}
            className="bg-indigo-600 dark:bg-indigo-600 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 active:scale-98 transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SYNC NOW</span>
          </button>
        )}
      </div>
    </header>
  );
};
