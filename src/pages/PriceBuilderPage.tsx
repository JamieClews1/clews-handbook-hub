import { AdminPageLayout } from "@/components/AdminPageLayout";
import { QuoteBuilder } from "@/components/pricing/QuoteBuilder";

const PriceBuilderPage = () => {
  return (
    <AdminPageLayout
      title="Price Builder"
      description="Build customer quotes from live rate cards. Pick a customer type, zone and items to generate a priced quote."
    >
      <QuoteBuilder />
    </AdminPageLayout>
  );
};

export default PriceBuilderPage;
