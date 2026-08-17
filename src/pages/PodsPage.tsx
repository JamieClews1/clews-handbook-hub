import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PodsPanel } from "@/components/data-uploads/PodsPanel";

const PodsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/data-uploads">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Data Uploads
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold">PODs</h1>
          <p className="text-muted-foreground">
            Proof of delivery PDFs — upload here and they are matched to job tickets automatically.
          </p>
        </div>

        <PodsPanel canManage />
      </div>
    </div>
  );
};

export default PodsPage;
