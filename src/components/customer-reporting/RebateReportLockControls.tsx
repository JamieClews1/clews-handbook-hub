import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock, Unlock, AlertTriangle, RefreshCw, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { LockedReport, RebateValueChange } from "@/hooks/useLockedRebateReport";

interface RebateReportLockControlsProps {
  lockedReport: LockedReport | null;
  valueChanges: RebateValueChange[];
  loading: boolean;
  onLock: () => Promise<boolean | undefined>;
  onUnlock: () => Promise<boolean | undefined>;
  onDismissChanges: () => void;
  onUpdateWithNewValues: () => Promise<boolean | undefined>;
}

export function RebateReportLockControls({
  lockedReport,
  valueChanges,
  loading,
  onLock,
  onUnlock,
  onDismissChanges,
  onUpdateWithNewValues,
}: RebateReportLockControlsProps) {
  const { toast } = useToast();
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleLock = async () => {
    const success = await onLock();
    if (success) {
      toast({
        title: "Report Locked",
        description: "This report has been locked. Rebate values are now preserved.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to lock the report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUnlock = async () => {
    const success = await onUnlock();
    setConfirmUnlockOpen(false);
    if (success) {
      toast({
        title: "Report Unlocked",
        description: "This report is now unlocked and will use current rebate values.",
      });
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    const success = await onUpdateWithNewValues();
    setUpdating(false);
    if (success) {
      toast({
        title: "Report Updated",
        description: "The locked report has been updated with the latest rebate values.",
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Value Changes Banner */}
      {valueChanges.length > 0 && (
        <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 !text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            Rebate values have changed since this report was locked
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1 text-sm">
              {valueChanges.map((change, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="font-medium">{change.item_name}</span>
                  <span className="text-muted-foreground">({change.field}):</span>
                  <span className="line-through text-red-600">£{change.locked_value.toFixed(2)}</span>
                  <span>→</span>
                  <span className="text-green-600 font-medium">£{change.current_value.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={onDismissChanges}
                className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/50"
              >
                <X className="h-3 w-3 mr-1" />
                Ignore
              </Button>
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={updating}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${updating ? "animate-spin" : ""}`} />
                Update Report
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Lock/Unlock Button */}
      <div className="flex items-center gap-2">
        {lockedReport ? (
          <>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700">
              <Lock className="h-3 w-3 mr-1" />
              Locked {format(new Date(lockedReport.locked_at), "d MMM yyyy HH:mm")}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmUnlockOpen(true)}
              disabled={loading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Unlock className="h-3 w-3 mr-1" />
              Unlock
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLock}
            disabled={loading}
          >
            <Lock className="h-3 w-3 mr-1" />
            {loading ? "Locking..." : "Lock Report"}
          </Button>
        )}
      </div>

      {/* Unlock Confirmation */}
      <AlertDialog open={confirmUnlockOpen} onOpenChange={setConfirmUnlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this report?</AlertDialogTitle>
            <AlertDialogDescription>
              Unlocking will remove the saved snapshot. Future reports for this period will use the latest rebate values instead of the locked values.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlock} className="bg-red-600 hover:bg-red-700">
              Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
