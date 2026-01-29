import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, AlertTriangle, ClipboardList, Loader2, CheckCircle, User, ClipboardSignature } from "lucide-react";
import { format } from "date-fns";
import clewsLogo from "@/assets/clews-logo.png";

interface RAMS {
  id: string;
  reference_code: string;
  title: string;
  applicable_to: string[];
  notice_to_drivers: string | null;
  created_date: string;
  review_date: string;
  creator_signature: string | null;
  creator_name: string | null;
  signed_at: string | null;
  is_mandatory: boolean;
  user_types: string[];
}

interface RAMSSignature {
  rams_id: string;
  signed_at: string;
}

const RAMSPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const [ramsList, setRamsList] = useState<RAMS[]>([]);
  const [loadingRAMS, setLoadingRAMS] = useState(true);
  const [userSignatures, setUserSignatures] = useState<RAMSSignature[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManagement, setIsManagement] = useState(false);
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchRAMSList();
      fetchUserSignatures();
      checkAdminRole();
    }
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) return;
    const { data: adminData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!adminData);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_types')
      .eq('id', user.id)
      .single();
    setIsManagement(profileData?.user_types?.includes('management') || false);
  };

  // Auto-navigate to specific RAMS from URL query param
  useEffect(() => {
    if (!loadingRAMS && ramsList.length > 0 && !hasAutoNavigated) {
      const ramsId = searchParams.get('id');
      if (ramsId) {
        const rams = ramsList.find(r => r.id === ramsId);
        if (rams) {
          setHasAutoNavigated(true);
          navigate(`/rams/${rams.id}`);
        }
      }
    }
  }, [loadingRAMS, ramsList, searchParams, hasAutoNavigated, navigate]);

  const fetchRAMSList = async () => {
    setLoadingRAMS(true);
    const { data, error } = await supabase
      .from("rams")
      .select("*");

    if (!error) {
      const sortedData = ((data as RAMS[]) || []).sort((a, b) => {
        const numA = parseInt(a.reference_code.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.reference_code.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setRamsList(sortedData);
    }
    setLoadingRAMS(false);
  };

  const fetchUserSignatures = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("rams_user_signatures")
      .select("rams_id, signed_at")
      .eq("user_id", user.id);

    if (!error) {
      setUserSignatures(data || []);
    }
  };

  const isRamsSigned = (ramsId: string) => {
    return userSignatures.some(sig => sig.rams_id === ramsId);
  };

  const getSignatureDate = (ramsId: string) => {
    const sig = userSignatures.find(s => s.rams_id === ramsId);
    return sig ? new Date(sig.signed_at) : null;
  };

  if (loading || loadingRAMS) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src={clewsLogo} alt="Clews Recycling" className="h-12 w-auto" />
          {/* Desktop controls */}
          <div className="hidden md:flex items-center gap-2">
            {(isAdmin || isManagement) && (
              <Link to="/mass-sign-off">
                <Button variant="default" size="sm" className="gap-2">
                  <ClipboardSignature className="h-4 w-4" />
                  <span>Mass Sign-Off</span>
                </Button>
              </Link>
            )}
            <Link to="/my-profile">
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span>My Profile</span>
              </Button>
            </Link>
            <Link to="/portal">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Portal</span>
              </Button>
            </Link>
          </div>
          {/* Mobile nav buttons only */}
          <div className="flex md:hidden items-center gap-2">
            <Link to="/my-profile">
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/portal">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile controls bar */}
      <div className="md:hidden bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-center gap-3">
          {(isAdmin || isManagement) && (
            <Link to="/mass-sign-off">
              <Button variant="default" size="sm" className="gap-2">
                <ClipboardSignature className="h-4 w-4" />
                <span>Mass Sign-Off</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-accent to-primary py-12">
        <div className="container mx-auto px-4 text-center">
          <FileText className="h-16 w-16 text-primary-foreground mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-primary-foreground mb-2">
            Risk Assessments & Method Statements
          </h2>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Essential documentation for safe work practices and regulatory compliance.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                What are RAMS?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                <strong>Risk Assessments and Method Statements (RAMS)</strong> are essential documents 
                that outline potential hazards and the safe procedures for carrying out work activities.
              </p>
              <p>
                These documents help ensure that all employees understand the risks involved in their 
                work and the steps they need to take to protect themselves and others.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Available Documents
              </CardTitle>
              <CardDescription>
                Click a document to view details and sign
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRAMS ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-muted-foreground">Loading RAMS...</p>
                </div>
              ) : ramsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No RAMS documents available.</p>
                  <p className="text-sm mt-2">Contact your line manager for documentation.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ramsList.map((rams) => {
                    const signed = isRamsSigned(rams.id);
                    const signedDate = getSignatureDate(rams.id);
                    return (
                      <div key={rams.id}>
                        <div
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            signed
                              ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                              : 'hover:bg-accent/50 hover:border-primary/50'
                          }`}
                          onClick={() => navigate(`/rams/${rams.id}`)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-lg">{rams.reference_code}</span>
                                {rams.is_mandatory && (
                                  <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                                )}
                                {signed && (
                                  <Badge variant="default" className="text-xs gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Signed
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground">{rams.title}</p>
                              <div className="flex gap-1 flex-wrap">
                                {rams.user_types.map(type => (
                                  <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                                ))}
                              </div>
                              {signed && signedDate && (
                                <p className="text-xs text-muted-foreground">
                                  Signed on {format(signedDate, "PPP")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default RAMSPage;
