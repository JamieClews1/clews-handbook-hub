import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Fuel, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePricingSettings } from "@/hooks/usePricingSettings";

export function PricingSettings() {
  const { toast } = useToast();
  const { settings, loading, updateSetting } = usePricingSettings();

  const toggleFuel = async (value: boolean) => {
    try {
      await updateSetting("auto_add_fuel_surcharge", value);
      toast({
        title: value ? "Fuel surcharges enabled" : "Fuel surcharges disabled",
        description: value
          ? "Quotes will automatically include the applicable fuel surcharge."
          : "Quotes will no longer add a fuel surcharge automatically.",
      });
    } catch {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fuel className="h-4 w-4 text-primary" /> Fuel surcharges
          </CardTitle>
          <CardDescription>
            Automatically add the applicable fuel surcharge to quotes built in the Price Builder.
            Surcharge rates are managed in the Fuel Surcharges section and are matched by vehicle
            type (Skip, RoRo, Artic) and delivery zone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="auto-fuel" className="text-sm font-medium">
                Auto-add fuel surcharges to rates
              </Label>
              <p className="text-sm text-muted-foreground">
                When on, the Price Builder adds a fuel surcharge line to every priced item it
                can match, and includes it in the quote total.
              </p>
            </div>
            <Switch
              id="auto-fuel"
              checked={settings.auto_add_fuel_surcharge}
              onCheckedChange={toggleFuel}
              disabled={loading}
            />
          </div>

          <Link to="/performance-hub/fuel-surcharges">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" /> Manage fuel surcharge rates
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default PricingSettings;
