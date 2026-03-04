import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, Activity, Truck } from "lucide-react";

const WeighOnePage = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary-foreground" />
          </div>
          WeighOne
        </h1>
        <p className="text-muted-foreground mt-1">Weighbridge and waste measurement software</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Live Weighbridge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Connect to weighbridge hardware and capture weight readings automatically.</p>
            <div className="mt-4 p-12 bg-muted/30 rounded-lg text-center">
              <p className="text-4xl font-bold text-foreground tabular-nums">0.00 t</p>
              <p className="text-xs text-muted-foreground mt-1">Live weight reading</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Transaction Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">All weighbridge transactions with vehicle, customer, waste type, and net weight.</p>
            <div className="mt-4 p-8 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
              Coming soon — live transaction table
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WeighOnePage;
