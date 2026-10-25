import { WeighbridgeRatesSettings } from "@/components/weighone/WeighbridgeRatesSettings";
import { PageHeading } from "@/components/PageHeading";

export default function WeighOnePricingPage() {
  return <div className="container max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
    <PageHeading title="Pricing" description="WeighOne" />
    <WeighbridgeRatesSettings />
  </div>;
}