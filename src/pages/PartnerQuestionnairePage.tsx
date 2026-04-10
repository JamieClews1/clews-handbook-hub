import { PartnerQuestionnaireForm } from "@/components/duty-of-care/PartnerQuestionnaireForm";
import { useParams } from "react-router-dom";
import clewsLogo from "@/assets/clews-logo.png";

const PartnerQuestionnairePage = () => {
  const { shareToken } = useParams<{ shareToken: string }>();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <PartnerQuestionnaireForm
          shareToken={shareToken}
          isPublic={true}
        />
      </main>

      <footer className="border-t border-border/50 py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} WasteOne. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PartnerQuestionnairePage;
