import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing?: boolean;
  onSyncNow?: () => void;
  lastSyncError?: string;
}

export const OfflineIndicator = ({
  isOnline,
  pendingCount,
  isSyncing,
  onSyncNow,
  lastSyncError,
}: OfflineIndicatorProps) => {
  return (
    <div className="flex items-center gap-2">
      {/* Connection status */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          isOnline
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        )}
      >
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3" />
            <span className="hidden sm:inline">Online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            <span className="hidden sm:inline">Offline</span>
          </>
        )}
      </div>

      {/* Pending sync count */}
      {pendingCount > 0 && (
        <Badge
          variant="secondary"
          className={cn(
            'gap-1',
            lastSyncError
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          )}
        >
          {lastSyncError ? (
            <AlertCircle className="h-3 w-3" />
          ) : (
            <CloudOff className="h-3 w-3" />
          )}
          {pendingCount} pending
        </Badge>
      )}

      {/* Synced indicator */}
      {pendingCount === 0 && isOnline && (
        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <Check className="h-3 w-3" />
          <span className="hidden sm:inline">Synced</span>
        </Badge>
      )}

      {/* Sync button */}
      {isOnline && pendingCount > 0 && onSyncNow && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSyncNow}
          disabled={isSyncing}
          className="h-7 px-2"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
        </Button>
      )}
    </div>
  );
};
