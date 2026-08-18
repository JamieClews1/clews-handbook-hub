import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WtnDocumentsPanel } from "@/components/wtn";
import { useAuth } from "@/hooks/useAuth";

const PdaUploadsPage = () => {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/performance-hub">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Performance Hub
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold">PDA Uploads</h1>
          <p className="text-muted-foreground">
            Upload waste transfer note PDFs straight from the Skiptrak folder — matched to job tickets and searchable in
            the Data Hub.
          </p>
        </div>

        <WtnDocumentsPanel canManage />
      </div>
    </div>
  );
};

export default PdaUploadsPage;
