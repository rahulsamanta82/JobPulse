import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './lib/theme';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { SyncModal } from './components/SyncModal';
import { JobDiscoveryPage } from './pages/JobDiscoveryPage';
import { JobDetailsPage } from './pages/JobDetailsPage';
import { SystemMonitorPage } from './pages/SystemMonitorPage';
import { IngestionHistoryPage } from './pages/IngestionHistoryPage';

export default function App() {
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] flex flex-col font-sans antialiased text-slate-800 dark:text-slate-100 selection:bg-indigo-500 selection:text-white transition-colors">
          <Navbar onOpenSyncModal={() => setIsSyncModalOpen(true)} />

          <main className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<JobDiscoveryPage />} />
              <Route path="/discovery" element={<JobDiscoveryPage />} />
              <Route path="/jobs/:id" element={<JobDetailsPage />} />
              <Route path="/system" element={<SystemMonitorPage />} />
              <Route path="/system-monitor" element={<SystemMonitorPage />} />
              <Route path="/system/ingestion" element={<IngestionHistoryPage />} />
              <Route path="/audit-trail" element={<IngestionHistoryPage />} />
            </Routes>
          </main>

          <Footer />

          <SyncModal
            isOpen={isSyncModalOpen}
            onClose={() => setIsSyncModalOpen(false)}
          />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
