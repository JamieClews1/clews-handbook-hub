import { useState } from "react";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { Contact } from "./Contact";

const ContactPage = () => {
  const [language, setLanguage] = useState("en");

  return (
    <div className="min-h-screen bg-background">
      <Header language={language} onLanguageChange={setLanguage} />
      <Navigation language={language} />
      <Contact language={language} />
    </div>
  );
};

export default ContactPage;
