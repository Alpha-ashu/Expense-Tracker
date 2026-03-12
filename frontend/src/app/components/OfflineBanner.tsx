/**
 * OfflineBanner
 *
 * A slim fixed bar shown at the BOTTOM of the viewport when the device has no
 * internet connection. Uses `position: fixed` so it never participates in the
 * flex-row layout and cannot affect the width of sibling content divs.
 *
 * Syncing state is intentionally NOT shown here — the SyncStatusBar pill in
 * the TopBar already communicates sync progress non-intrusively. On reconnect
 * a single toast is fired instead of blocking any UI.
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useSyncStats } from '@/lib/offline-sync-engine';

export const OfflineBanner: React.FC = () => {
  const stats = useSyncStats();
  const isOffline = stats.status === 'offline';
  const wasSyncing = useRef(false);

  // Fire a toast once when we transition offline→online and sync starts.
  // This replaces the old full-width blocking banner for the syncing state.
  useEffect(() => {
    if (stats.status === 'syncing' && !wasSyncing.current) {
      wasSyncing.current = true;
      toast.info(
        stats.pendingCount > 0
          ? `Back online — syncing ${stats.pendingCount} pending change${stats.pendingCount !== 1 ? 's' : ''} in background.`
          : 'Back online — syncing data in background.',
        { duration: 3000, id: 'back-online-sync' },
      );
    }
    if (stats.status !== 'syncing') {
      wasSyncing.current = false;
    }
  }, [stats.status, stats.pendingCount]);

  // Only the offline bar is rendered into the DOM — and it's fixed-position
  // so it cannot affect flex siblings in App.tsx.
  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          key="offline-bar"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
          // fixed — completely outside the document flow, never affects layout
          className="fixed bottom-16 lg:bottom-4 left-1/2 -translate-x-1/2 z-[70] w-max max-w-[calc(100vw-2rem)]"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-xs font-medium shadow-lg">
            <WifiOff size={13} className="shrink-0" />
            <span>You're offline — changes will sync when internet returns.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
