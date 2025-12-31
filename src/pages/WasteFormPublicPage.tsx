import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { FacilityRecyclingForm } from "@/components/waste-reporting/FacilityRecyclingForm";
import clewsLogo from "@/assets/clews-logo.png";

const WasteFormPublicPage = () => {
  const { shareToken } = useParams<{ shareToken: string }>();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </Link>
              <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <FacilityRecyclingForm shareToken={shareToken} readOnly />
        </div>
      </main>
    </div>
  );
};

export default WasteFormPublicPage;
