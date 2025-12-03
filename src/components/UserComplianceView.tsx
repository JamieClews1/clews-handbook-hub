import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface RAMSItem {
  id: string;
  title: string;
  reference_code: string;
  is_mandatory: boolean;
  signed: boolean;
  signed_at?: string;
}

interface UserComplianceViewProps {
  userId: string;
  userTypes: string[];
  userName: string;
}

export const UserComplianceView = ({ userId, userTypes, userName }: UserComplianceViewProps) => {
  const [ramsItems, setRamsItems] = useState<RAMSItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && ramsItems.length === 0) {
      fetchComplianceData();
    }
  }, [isOpen]);

  const fetchComplianceData = async () => {
    setLoading(true);
    try {
      // Fetch all RAMS applicable to this user's types
      const { data: allRams, error: ramsError } = await supabase
        .from("rams")
        .select("id, title, reference_code, is_mandatory, user_types")
        .order("title");

      if (ramsError) throw ramsError;

      // Fetch user's RAMS signatures
      const { data: signatures, error: sigError } = await supabase
        .from("rams_user_signatures")
        .select("rams_id, signed_at")
        .eq("user_id", userId);

      if (sigError) throw sigError;

      const signedRamsIds = new Map(
        signatures?.map(s => [s.rams_id, s.signed_at]) || []
      );

      // Filter RAMS by user types and map with signature status
      const applicableRams = (allRams || [])
        .filter(rams => {
          const ramsTypes = rams.user_types || [];
          return userTypes.some(ut => ramsTypes.includes(ut));
        })
        .map(rams => ({
          id: rams.id,
          title: rams.title,
          reference_code: rams.reference_code,
          is_mandatory: rams.is_mandatory,
          signed: signedRamsIds.has(rams.id),
          signed_at: signedRamsIds.get(rams.id) || undefined,
        }));

      setRamsItems(applicableRams);
    } catch (error) {
      console.error("Error fetching compliance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const signedCount = ramsItems.filter(r => r.signed).length;
  const pendingCount = ramsItems.filter(r => !r.signed).length;
  const mandatoryPending = ramsItems.filter(r => r.is_mandatory && !r.signed).length;

  if (userTypes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No user types assigned - no RAMS applicable
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>View Compliance</span>
          {!isOpen && ramsItems.length > 0 && (
            <span className="ml-auto flex gap-2">
              {mandatoryPending > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {mandatoryPending} mandatory pending
                </Badge>
              )}
            </span>
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : ramsItems.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">
            No RAMS applicable for this user's types
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{signedCount} signed</span>
              </div>
              <div className="flex items-center gap-1 text-amber-600">
                <XCircle className="h-4 w-4" />
                <span>{pendingCount} pending</span>
              </div>
            </div>

            {/* Pending RAMS */}
            {pendingCount > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-destructive">Pending Sign-Off:</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {ramsItems
                    .filter(r => !r.signed)
                    .map(rams => (
                      <div key={rams.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-destructive/10">
                        <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                        <span className="truncate">{rams.reference_code} - {rams.title}</span>
                        {rams.is_mandatory && (
                          <Badge variant="destructive" className="text-xs ml-auto">
                            Mandatory
                          </Badge>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Signed RAMS */}
            {signedCount > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-green-600">Signed Off:</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {ramsItems
                    .filter(r => r.signed)
                    .map(rams => (
                      <div key={rams.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-green-500/10">
                        <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <span className="truncate">{rams.reference_code} - {rams.title}</span>
                        {rams.signed_at && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(rams.signed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
