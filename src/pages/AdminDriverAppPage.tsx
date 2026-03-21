import { AdminPageLayout } from "@/components/AdminPageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Smartphone,
  Download,
  Shield,
  Key,
  Truck,
  Camera,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Globe,
  Wifi,
  Clock,
  Users,
  Settings,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: 1,
    title: "Access the Driver App",
    icon: Globe,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The Driver App is a Progressive Web App (PWA) accessible at:
        </p>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-sm break-all">
          <Globe className="w-4 h-4 shrink-0 text-primary" />
          https://clewshandbook.lovable.app/driver
        </div>
        <p className="text-sm text-muted-foreground">
          Open this URL in <strong>Google Chrome</strong> on the driver's Android device or tablet.
        </p>
      </div>
    ),
  },
  {
    number: 2,
    title: "Install to Home Screen",
    icon: Download,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">To install as a standalone app:</p>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Open the URL in Chrome on the Android device</li>
          <li>Tap the <strong>three-dot menu</strong> (⋮) in the top-right</li>
          <li>Select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong></li>
          <li>Confirm the installation prompt</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          The app icon will appear on the device's home screen and launch in full-screen mode.
        </p>
      </div>
    ),
  },
  {
    number: 3,
    title: "Set Up Driver PINs",
    icon: Key,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Each driver needs a <strong>Driver Number</strong> and <strong>4–6 digit PIN</strong> to log in.
        </p>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Navigate to <strong>WasteOne → RouteOne → Setup → Drivers</strong></li>
          <li>Click on a driver to edit their details</li>
          <li>Set their <strong>Driver Number</strong> and <strong>PIN</strong></li>
          <li>Ensure the driver is marked as <strong>Active</strong></li>
        </ol>
      </div>
    ),
  },
  {
    number: 4,
    title: "Assign Vehicles",
    icon: Truck,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Assign each driver a default vehicle so the app can display it on login.
        </p>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Go to <strong>WasteOne → RouteOne → Setup → Vehicles</strong></li>
          <li>Ensure all fleet vehicles are registered with correct registration plates</li>
          <li>In the Drivers setup, assign the appropriate vehicle to each driver</li>
        </ol>
      </div>
    ),
  },
];

const features = [
  {
    icon: Truck,
    title: "Job Management",
    description: "Drivers see their assigned jobs for the day with Start, Complete, and Wasted Journey actions.",
  },
  {
    icon: Camera,
    title: "Photo Evidence",
    description: "Capture Before, After, and Contamination photos stored securely in cloud storage.",
  },
  {
    icon: MapPin,
    title: "Navigation",
    description: "Site addresses link directly to Google Maps for turn-by-turn directions.",
  },
  {
    icon: AlertTriangle,
    title: "Contamination Reporting",
    description: "Flag contamination issues which automatically mark the job as 'Query' for the office.",
  },
  {
    icon: Clock,
    title: "Session Persistence",
    description: "14-hour session persistence — drivers stay logged in throughout their shift.",
  },
  {
    icon: Wifi,
    title: "Offline Capability",
    description: "PWA architecture allows the app to load even with poor signal in remote areas.",
  },
];

const AdminDriverAppPage = () => {
  return (
    <AdminPageLayout title="Mobile Driver App" description="Build and setup guide for the RouteOne driver mobile application">
      <div className="space-y-6">

        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
            <CardDescription>
              The RouteOne Driver App is a standalone, mobile-first Progressive Web App (PWA)
              designed for outdoor operational use. Drivers authenticate with a custom PIN-based
              login and manage their daily job assignments directly from their phone or tablet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1"><Shield className="w-3 h-3" /> PIN Authentication</Badge>
              <Badge variant="secondary" className="gap-1"><Camera className="w-3 h-3" /> Photo Capture</Badge>
              <Badge variant="secondary" className="gap-1"><MapPin className="w-3 h-3" /> Google Maps</Badge>
              <Badge variant="secondary" className="gap-1"><AlertTriangle className="w-3 h-3" /> Contamination Reports</Badge>
              <Badge variant="secondary" className="gap-1"><Wifi className="w-3 h-3" /> PWA / Offline</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Setup Steps */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Setup Steps</h2>
          {steps.map((step) => (
            <Card key={step.number}>
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {step.number}
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <step.icon className="w-4 h-4 text-primary" />
                      {step.title}
                    </h3>
                    {step.content}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Features */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">App Features</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <feature.icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">{feature.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Admin Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Admin Management
            </CardTitle>
            <CardDescription>
              Monitor and manage driver activity from the office
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The Driver App management dashboard is available at <strong>WasteOne → RouteOne → Setup → Driver App</strong>.
              From there you can:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                Share the PWA install link with drivers
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                View real-time metrics — Total, Completed, and In Progress jobs
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                Monitor driver PIN status and assigned vehicles
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                View all photo evidence uploaded by drivers
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminPageLayout>
  );
};

export default AdminDriverAppPage;
