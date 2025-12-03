import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ComplianceItem {
  id: string;
  title: string;
  reference_code?: string;
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
  const [ramsItems, setRamsItems] = useState<ComplianceItem[]>([]);
  const [toolboxTalks, setToolboxTalks] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && ramsItems.length === 0 && toolboxTalks.length === 0) {
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
      const { data: ramsSignatures, error: ramsSigError } = await supabase
        .from("rams_user_signatures")
        .select("rams_id, signed_at")
        .eq("user_id", userId);

      if (ramsSigError) throw ramsSigError;

      const signedRamsIds = new Map(
        ramsSignatures?.map(s => [s.rams_id, s.signed_at]) || []
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

      // Fetch all Toolbox Talks applicable to this user's types
      const { data: allToolboxTalks, error: toolboxError } = await supabase
        .from("toolbox_talks")
        .select("id, title, is_mandatory, user_types")
        .order("title");

      if (toolboxError) throw toolboxError;

      // Fetch user's Toolbox Talk signatures
      const { data: toolboxSignatures, error: toolboxSigError } = await supabase
        .from("toolbox_talk_signatures")
        .select("toolbox_talk_id, signed_at")
        .eq("user_id", userId);

      if (toolboxSigError) throw toolboxSigError;

      const signedToolboxIds = new Map(
        toolboxSignatures?.map(s => [s.toolbox_talk_id, s.signed_at]) || []
      );

      // Filter Toolbox Talks by user types and map with signature status
      const applicableToolbox = (allToolboxTalks || [])
        .filter(talk => {
          const talkTypes = talk.user_types || [];
          return userTypes.some(ut => talkTypes.includes(ut));
        })
        .map(talk => ({
          id: talk.id,
          title: talk.title,
          is_mandatory: talk.is_mandatory,
          signed: signedToolboxIds.has(talk.id),
          signed_at: signedToolboxIds.get(talk.id) || undefined,
        }));

      setToolboxTalks(applicableToolbox);
    } catch (error) {
      console.error("Error fetching compliance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const ramsSignedCount = ramsItems.filter(r => r.signed).length;
  const ramsPendingCount = ramsItems.filter(r => !r.signed).length;
  const ramsMandatoryPending = ramsItems.filter(r => r.is_mandatory && !r.signed).length;

  const toolboxSignedCount = toolboxTalks.filter(t => t.signed).length;
  const toolboxPendingCount = toolboxTalks.filter(t => !t.signed).length;
  const toolboxMandatoryPending = toolboxTalks.filter(t => t.is_mandatory && !t.signed).length;

  const totalMandatoryPending = ramsMandatoryPending + toolboxMandatoryPending;

  if (userTypes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No user types assigned - no documents applicable
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>View Compliance</span>
          {!isOpen && (ramsItems.length > 0 || toolboxTalks.length > 0) && (
            <span className="ml-auto flex gap-2">
              {totalMandatoryPending > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {totalMandatoryPending} mandatory pending
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
        ) : (
          <div className="space-y-4">
            {/* RAMS Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">RAMS</h4>
              {ramsItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">No RAMS applicable</div>
              ) : (
                <>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>{ramsSignedCount} signed</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600">
                      <XCircle className="h-4 w-4" />
                      <span>{ramsPendingCount} pending</span>
                    </div>
                  </div>

                  {ramsPendingCount > 0 && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-medium text-destructive">Pending:</h5>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {ramsItems
                          .filter(r => !r.signed)
                          .map(rams => (
                            <div key={rams.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-destructive/10">
                              <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                              <span className="truncate">{rams.reference_code} - {rams.title}</span>
                              {rams.is_mandatory && (
                                <Badge variant="destructive" className="text-[10px] ml-auto">
                                  Mandatory
                                </Badge>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Toolbox Talks Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Toolbox Talks</h4>
              {toolboxTalks.length === 0 ? (
                <div className="text-sm text-muted-foreground">No Toolbox Talks applicable</div>
              ) : (
                <>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>{toolboxSignedCount} signed</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600">
                      <XCircle className="h-4 w-4" />
                      <span>{toolboxPendingCount} pending</span>
                    </div>
                  </div>

                  {toolboxPendingCount > 0 && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-medium text-destructive">Pending:</h5>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {toolboxTalks
                          .filter(t => !t.signed)
                          .map(talk => (
                            <div key={talk.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-destructive/10">
                              <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                              <span className="truncate">{talk.title}</span>
                              {talk.is_mandatory && (
                                <Badge variant="destructive" className="text-[10px] ml-auto">
                                  Mandatory
                                </Badge>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
