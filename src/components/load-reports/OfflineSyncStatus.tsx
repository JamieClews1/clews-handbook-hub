import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OfflineSyncStatusProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  onSync: () => void;
}

export function OfflineSyncStatus({ 
  isOnline, 
  isSyncing, 
  pendingCount, 
  onSync 
}: OfflineSyncStatusProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Connection status indicator */}
      <div 
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
          isOnline 
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        )}
      >
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3" />
            <span>Online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            <span>Offline</span>
          </>
        )}
      </div>

      {/* Pending sync count */}
      {pendingCount > 0 && (
        <Badge 
          variant="secondary" 
          className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        >
          <CloudOff className="h-3 w-3" />
          {pendingCount} pending
        </Badge>
      )}

      {/* Sync button */}
      {pendingCount > 0 && isOnline && (
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          className="gap-1.5 h-7"
        >
          <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
      )}

      {/* All synced indicator */}
      {pendingCount === 0 && isOnline && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Cloud className="h-3 w-3" />
          <span>All synced</span>
        </div>
      )}
    </div>
  );
}
