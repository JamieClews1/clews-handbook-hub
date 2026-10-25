import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { HandbookBuilder } from "@/components/HandbookBuilder";
import { Pencil, Eye } from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { Handbook } from "./Handbook";

const HandbookPage = () => {
  const [language, setLanguage] = useState("en");
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const editing = isAdmin && params.get("view") === "edit";

  return (
    <div className="min-h-screen bg-background">
      {isAdmin && <div className="container mx-auto px-4 py-3 flex justify-end">
        <Button variant="outline" onClick={() => setParams(prev => { const next = new URLSearchParams(prev); if (editing) next.delete("view"); else next.set("view", "edit"); return next; })}>
          {editing ? <Eye className="h-4 w-4 mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}{editing ? "View Handbook" : "Edit Handbook"}
        </Button>
      </div>}
      {editing ? <main className="container max-w-screen-2xl mx-auto px-4 py-6"><h1 className="text-2xl font-bold mb-6">Edit Handbook</h1><HandbookBuilder /></main> : <>
        <Header language={language} onLanguageChange={setLanguage} />
        <Navigation language={language} />
        <Handbook language={language} />
      </>}
    </div>
  );
};

export default HandbookPage;
