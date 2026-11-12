import HSDocumentsPage from "./HSDocumentsPage";
import { VisitorInductionsPanel } from "@/components/health-safety/VisitorInductionsPanel";

const SiteInductionsPage = () => (
  <div className="mx-auto max-w-screen-2xl space-y-10 p-4 md:p-6">
    <HSDocumentsPage
      category="site_induction"
      heading="Site Inductions"
      description="Read, understand and sign the site induction before working on site. Available in English, Polish, Ukrainian and Romanian."
      embedded
    />
    <VisitorInductionsPanel />
  </div>
);

export default SiteInductionsPage;
