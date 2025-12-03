import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, ClipboardList, Users } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  user_types: string[] | null;
}

interface RAMS {
  id: string;
  title: string;
  reference_code: string;
  user_types: string[];
}

interface SignatureRecord {
  user_id: string;
  rams_id: string;
}

const USER_TYPE_LABELS: Record<string, string> = {
  driver: "DRIVERS",
  yard: "YARD",
  office: "OFFICE",
  management: "MANAGEMENT"
};

const MassSignOffPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [rams, setRams] = useState<RAMS[]>([]);
  const [selectedRamsId, setSelectedRamsId] = useState<string>("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [existingSignatures, setExistingSignatures] = useState<SignatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [signingUser, setSigningUser] = useState<UserProfile | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  // Check if user has management role
  const [isManagement, setIsManagement] = useState(false);

  useEffect(() => {
    const checkManagement = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_types")
        .eq("id", user.id)
        .single();

      if (profile?.user_types?.includes("management")) {
        setIsManagement(true);
      } else {
        // Also check if admin
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        
        setIsManagement(!!adminRole);
      }
    };

    checkManagement();
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch all RAMS
      const { data: ramsData } = await supabase
        .from("rams")
        .select("id, title, reference_code, user_types")
        .order("title");

      if (ramsData) {
        setRams(ramsData);
      }

      // Fetch all users with profiles
      const { data: usersData } = await supabase
        .from("profiles")
        .select("id, email, full_name, user_types")
        .order("full_name");

      if (usersData) {
        setUsers(usersData);
      }

      setLoading(false);
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    const fetchSignatures = async () => {
      if (!selectedRamsId) {
        setExistingSignatures([]);
        return;
      }

      const { data } = await supabase
        .from("rams_user_signatures")
        .select("user_id, rams_id")
        .eq("rams_id", selectedRamsId);

      if (data) {
        setExistingSignatures(data);
      }
    };

    fetchSignatures();
  }, [selectedRamsId]);

  const handleUserTap = (userProfile: UserProfile) => {
    // Check if already signed
    const alreadySigned = existingSignatures.some(
      sig => sig.user_id === userProfile.id && sig.rams_id === selectedRamsId
    );

    if (alreadySigned) {
      toast({
        title: "Already Signed",
        description: `${userProfile.full_name || userProfile.email} has already signed this RAMS.`,
      });
      return;
    }

    setSigningUser(userProfile);
    setShowSignDialog(true);
  };

  const handleSignatureComplete = async (signatureData: string) => {
    if (!signingUser || !selectedRamsId) return;

    setIsSigning(true);
    
    const { error } = await supabase
      .from("rams_user_signatures")
      .insert({
        user_id: signingUser.id,
        rams_id: selectedRamsId,
        signature_image: signatureData,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed Successfully",
        description: `${signingUser.full_name || signingUser.email} has signed the RAMS.`,
      });
      
      // Update local state
      setExistingSignatures(prev => [...prev, { 
        user_id: signingUser.id, 
        rams_id: selectedRamsId 
      }]);
    }

    setIsSigning(false);
    setShowSignDialog(false);
    setSigningUser(null);
  };

  const selectedRams = rams.find(r => r.id === selectedRamsId);
  
  // Normalize user type for comparison (handles "Drivers" vs "driver", "Office" vs "office", etc.)
  const normalizeUserType = (type: string): string => {
    const normalized = type.toLowerCase().replace(/s$/, ''); // Remove trailing 's' and lowercase
    return normalized === 'driver' ? 'driver' : normalized; // Ensure 'drivers' -> 'driver'
  };

  // Group users by user_type, only showing those applicable to selected RAMS
  const groupedUsers = users.reduce((acc, userProfile) => {
    if (!userProfile.user_types || userProfile.user_types.length === 0) return acc;
    
    // If RAMS is selected, filter users by applicable user_types
    if (selectedRams) {
      const ramsTypesNormalized = selectedRams.user_types.map(normalizeUserType);
      const hasApplicableType = userProfile.user_types.some(
        type => ramsTypesNormalized.includes(normalizeUserType(type))
      );
      if (!hasApplicableType) return acc;
    }

    userProfile.user_types.forEach(type => {
      if (!acc[type]) acc[type] = [];
      // Avoid duplicates
      if (!acc[type].find(u => u.id === userProfile.id)) {
        acc[type].push(userProfile);
      }
    });
    
    return acc;
  }, {} as Record<string, UserProfile[]>);

  const isUserSigned = (userId: string) => {
    return existingSignatures.some(
      sig => sig.user_id === userId && sig.rams_id === selectedRamsId
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!isManagement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">
            This page is only accessible to management users.
          </p>
          <Link to="/portal">
            <Button>Back to Portal</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Compact for tablet */}
      <header className="bg-card border-b px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={clewsLogo} alt="Clews Logo" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-bold">Mass Sign-Off</h1>
              <p className="text-xs text-muted-foreground">RAMS Documents</p>
            </div>
          </div>
          <Link to="/portal">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {/* RAMS Selector */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <span className="font-medium">Select RAMS Document</span>
          </div>
          <Select value={selectedRamsId} onValueChange={setSelectedRamsId}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Choose a RAMS to sign..." />
            </SelectTrigger>
            <SelectContent>
              {rams.map(r => (
                <SelectItem key={r.id} value={r.id} className="text-base py-3">
                  {r.reference_code} - {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRams && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Applies to:</span>
              {selectedRams.user_types.map(type => (
                <Badge key={type} variant="secondary">
                  {USER_TYPE_LABELS[type] || type}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        {/* User List by Type */}
        {selectedRamsId ? (
          <div className="space-y-6">
            {Object.entries(groupedUsers).map(([type, typeUsers]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {USER_TYPE_LABELS[type] || type}
                  </h2>
                  <Badge variant="outline" className="ml-auto">
                    {typeUsers.filter(u => isUserSigned(u.id)).length}/{typeUsers.length} signed
                  </Badge>
                </div>
                <div className="space-y-2">
                  {typeUsers.map(userProfile => {
                    const signed = isUserSigned(userProfile.id);
                    return (
                      <button
                        key={userProfile.id}
                        onClick={() => handleUserTap(userProfile)}
                        disabled={signed}
                        className={`w-full rounded-xl p-4 text-left transition-all active:scale-[0.98] ${
                          signed
                            ? "bg-green-500/10 border-2 border-green-500/30"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xl font-semibold ${signed ? "text-green-700 dark:text-green-400" : ""}`}>
                            {userProfile.full_name || userProfile.email}
                          </span>
                          {signed ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                              <CheckCircle className="h-5 w-5" />
                              <span className="text-sm font-medium">Signed</span>
                            </div>
                          ) : (
                            <span className="text-sm opacity-80">Tap to sign</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {Object.keys(groupedUsers).length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No users found with the applicable user types for this RAMS.
                </p>
              </Card>
            )}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Select a RAMS document above to begin the mass sign-off process.
            </p>
          </Card>
        )}
      </main>

      {/* Signature Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Confirm Signature
            </DialogTitle>
            <DialogDescription className="text-base">
              {signingUser?.full_name || signingUser?.email} is signing:
              <br />
              <strong>{selectedRams?.reference_code} - {selectedRams?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <SignaturePad
            onSave={handleSignatureComplete}
            onCancel={() => {
              setShowSignDialog(false);
              setSigningUser(null);
            }}
          />

          {isSigning && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MassSignOffPage;
