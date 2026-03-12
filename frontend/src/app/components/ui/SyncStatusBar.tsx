/**
 * SyncStatusBar
 *
 * A small pill/badge that reflects the current sync status.
 * Renders inline — suitable for the TopBar or any header area.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSyncStats, OverallSyncStatus } from '@/lib/offline-sync-engine';

interface Config {
  icon: React.ReactNode;
  label: string;
  className: string;
}

const STATUS_CONFIG: Record<OverallSyncStatus, Config> = {
  offline: {
    icon: <CloudOff size={13} className="shrink-0" />,
    label: 'Offline',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  syncing: {
    icon: <RefreshCw size={13} className="shrink-0 animate-spin" />,
    label: 'Syncing…',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  synced: {
    icon: <CheckCircle2 size={13} className="shrink-0" />,
    label: 'Synced',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  error: {
    icon: <AlertCircle size={13} className="shrink-0" />,
    label: 'Sync error',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  idle: {
    icon: <Cloud size={13} className="shrink-0" />,
    label: 'Sync ready',
    className: 'bg-gray-100 text-gray-500 border-gray-200',
  },
};

interface SyncStatusBarProps {
  /** When true, only show the icon without a text label */
  compact?: boolean;
  className?: string;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ compact = false, className = '' }) => {
  const stats  = useSyncStats();
  const config = STATUS_CONFIG[stats.status];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stats.status}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        title={
          stats.errorMessage ??
          (stats.pendingCount > 0
            ? `${stats.pendingCount} change${stats.pendingCount > 1 ? 's' : ''} pending`
            : stats.lastSyncedAt
              ? `Last synced ${stats.lastSyncedAt.toLocaleTimeString()}`
              : 'Not synced yet')
        }
        className={[
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium select-none',
          config.className,
          className,
        ].join(' ')}
      >
        {config.icon}
        {!compact && (
          <span>
            {config.label}
            {stats.pendingCount > 0 && stats.status !== 'offline' && (
              <span className="ml-1 opacity-70">({stats.pendingCount})</span>
            )}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
