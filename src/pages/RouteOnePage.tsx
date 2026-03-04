import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Route, Calendar, Truck, MapPin } from "lucide-react";

const RouteOnePage = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Route className="h-5 w-5 text-primary-foreground" />
          </div>
          RouteOne
        </h1>
        <p className="text-muted-foreground mt-1">Transport management and routing software</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Job Scheduling
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Daily and weekly job scheduling with driver assignment and drag-and-drop routing.</p>
            <div className="mt-4 p-8 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
              Coming soon — scheduling interface
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Driver Dispatch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Assign jobs to drivers, track progress, and manage vehicle fleets in real time.</p>
            <div className="mt-4 p-8 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
              Coming soon — dispatch board
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Live Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">See all active drivers and job locations on a live operational map.</p>
            <div className="mt-4 p-8 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
              Coming soon — live map view
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RouteOnePage;
