import { useState } from "react";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { Handbook } from "./Handbook";

const HandbookPage = () => {
  const [language, setLanguage] = useState("en");

  return (
    <div className="min-h-screen bg-background">
      <Header language={language} onLanguageChange={setLanguage} />
      <Navigation language={language} />
      <Handbook language={language} />
    </div>
  );
};

export default HandbookPage;
