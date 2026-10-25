import { WeighbridgeRatesSettings } from "@/components/weighone/WeighbridgeRatesSettings";

export default function WeighOnePricingPage() {
  return <div className="container max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
    <header><p className="text-sm text-muted-foreground">WeighOne</p><h1 className="text-2xl font-bold">Pricing</h1></header>
    <WeighbridgeRatesSettings />
  </div>;
}