import { useState } from "react";
import { AdminPageLayout } from "@/components/AdminPageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadReportSettings } from "@/components/load-reports/LoadReportSettings";
import { BanksmanAppGuide } from "@/components/apps/BanksmanAppGuide";
import { BanksmanInstallCard } from "@/components/apps/BanksmanInstallCard";
import { LoadReportsInstallCard } from "@/components/apps/LoadReportsInstallCard";
import { OfficeAppInstallCard } from "@/components/apps/OfficeAppInstallCard";
import { OFFICE_APP_TILES, officeTileNavItem } from "@/lib/office-app";
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
  Settings,
  ExternalLink,
  HardHat,
  Scale,
  Weight,
  Package,
  FileText,
  ClipboardList,
  Users,
  RefreshCw,
  Building2,
  Lock,
} from "lucide-react";

type Step = { number: number; title: string; icon: typeof Globe; content: React.ReactNode };
type Feature = { icon: typeof Globe; title: string; description: string };

/* ─── Reusable guide renderer ─── */
const AppGuide = ({
  overview,
  badges,
  steps,
  features,
  extra,
}: {
  overview: string;
  badges: { icon: typeof Globe; label: string }[];
  steps: Step[];
  features: Feature[];
  extra?: React.ReactNode;
}) => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Overview</CardTitle>
        <CardDescription>{overview}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <Badge key={b.label} variant="secondary" className="gap-1">
              <b.icon className="w-3 h-3" /> {b.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>

    {extra}

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
  </div>
);

const UrlBox = ({ url }: { url: string }) => (
  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-sm break-all">
    <Globe className="w-4 h-4 shrink-0 text-primary" />
    {url}
  </div>
);

/* ─── Driver App ─── */
const driverSteps: Step[] = [
  {
    number: 1,
    title: "Access the Driver App",
    icon: Globe,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The Driver App is a Progressive Web App (PWA) accessible at:
        </p>
        <UrlBox url="https://clewshandbook.lovable.app/driver" />
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
      </div>
    ),
  },
  {
    number: 3,
    title: "Set Up Driver Logins",
    icon: Key,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Each driver needs a <strong>Username</strong> and <strong>4–6 digit PIN</strong> to log in.
        </p>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Navigate to <strong>WasteOne → RouteOne → Setup → Drivers</strong></li>
          <li>Click on a driver to edit their details</li>
          <li>Set their <strong>Username</strong> and <strong>PIN</strong></li>
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

const driverFeatures: Feature[] = [
  { icon: Truck, title: "Job Management", description: "Drivers see their assigned jobs for the day with Start, Complete, and Wasted Journey actions." },
  { icon: Camera, title: "Photo Evidence", description: "Capture Before, After, and Contamination photos stored securely in cloud storage." },
  { icon: MapPin, title: "Navigation", description: "Site addresses link directly to Google Maps for turn-by-turn directions." },
  { icon: AlertTriangle, title: "Contamination Reporting", description: "Flag contamination issues which automatically mark the job as 'Query' for the office." },
  { icon: Clock, title: "Session Persistence", description: "14-hour session persistence — drivers stay logged in throughout their shift." },
  { icon: Wifi, title: "Offline Capability", description: "PWA architecture allows the app to load even with poor signal in remote areas." },
];

/* ─── Banksman App ─── (guide moved to shared BanksmanAppGuide component) */

const loadReportSteps: Step[] = [
  {
    number: 1,
    title: "Open Load Reports",
    icon: Globe,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Load Reports is part of the internal platform. Staff access it from{" "}
          <strong>Compliance → Load Reports</strong>, or directly at:
        </p>
        <UrlBox url="https://clewshandbook.lovable.app/load-reports" />
      </div>
    ),
  },
  {
    number: 2,
    title: "Configure Waste Types & Weights",
    icon: Scale,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Set the waste types, default average weights and pallet weights used when tallying loads.
          Use the button above to open the settings.
        </p>
      </div>
    ),
  },
  {
    number: 3,
    title: "Record & Review Loads",
    icon: ClipboardList,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Operators tally each load, review the calculated tonnages, and generate load reports and
          certificates of destruction for customers.
        </p>
      </div>
    ),
  },
  {
    number: 4,
    title: "Add Load Reports to a phone",
    icon: Smartphone,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Open the URL below on the phone first and sign in, then add it to the home screen:
        </p>
        <UrlBox url="https://clewshandbook.lovable.app/load-reports" />
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li><strong>iPhone:</strong> in Safari tap <strong>Share</strong> → <strong>Add to Home Screen</strong> → <strong>Add</strong></li>
          <li><strong>Android:</strong> in Chrome tap <strong>⋮</strong> → <strong>Install app</strong> (or <strong>Add to Home screen</strong>)</li>
          <li>Open it from the home screen icon — it launches full screen straight into Load Reports</li>
        </ol>
      </div>
    ),
  },
];


const loadReportFeatures: Feature[] = [
  { icon: Package, title: "Load Tallying", description: "Count items and pallets per waste type to build an accurate load." },
  { icon: Scale, title: "Weight Calculation", description: "Automatic tonnage from configurable default and pallet weights." },
  { icon: FileText, title: "Reports & Certificates", description: "Generate load reports and certificates of destruction." },
  { icon: Wifi, title: "Offline Support", description: "Continue capturing loads even with an unreliable connection." },
];


/* ─── Office App ─── */
const officeSteps: Step[] = [
  {
    number: 1,
    title: "Open the Office App",
    icon: Globe,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Open this address on the office PC, tablet or phone:</p>
        <UrlBox url="https://portal.clewsrecycling.co.uk/office" />
      </div>
    ),
  },
  {
    number: 2,
    title: "Install it",
    icon: Download,
    content: (
      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
        <li><strong>PC (Chrome or Edge):</strong> click <strong>Install Office App</strong> at the top of the app, or the install icon in the address bar</li>
        <li><strong>iPhone / iPad:</strong> in Safari tap <strong>Share</strong> → <strong>Add to Home Screen</strong></li>
        <li><strong>Android:</strong> in Chrome tap <strong>⋮</strong> → <strong>Add to Home screen</strong></li>
      </ol>
    ),
  },
  {
    number: 3,
    title: "Sign in with username and PIN",
    icon: Key,
    content: (
      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
        <li>Username is the first part of the work email, before the @</li>
        <li>Starting PIN is <strong>1234</strong> — the app asks them to choose their own straight away</li>
        <li>First time on each device they enter their normal portal password once; after that the PIN is enough</li>
      </ol>
    ),
  },
  {
    number: 4,
    title: "Manage office staff",
    icon: Users,
    content: (
      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
        <li>Only accounts marked as <strong>Office</strong> in <strong>Admin → Users</strong> are set up for the app</li>
        <li>Forgotten PIN: use <strong>Reset Office PIN</strong> on their row in Admin → Users (back to 1234)</li>
        <li>Five wrong PINs lock the account for 15 minutes</li>
        <li>Which tiles each person sees follows Section Visibility, same as the portal menu</li>
      </ol>
    ),
  },
];

const officeFeatures: Feature[] = OFFICE_APP_TILES.map((t) => ({
  icon: (officeTileNavItem(t)?.icon as typeof Globe | undefined) ?? ClipboardList,
  title: t.label,
  description: t.description,
}));

const LaunchButton = ({ url, label }: { url: string; label: string }) => (
  <Button asChild variant="outline" className="gap-2">
    <a href={url} target="_blank" rel="noopener noreferrer">
      <ExternalLink className="w-4 h-4" /> {label}
    </a>
  </Button>
);

const AdminAppsPage = () => {
  const [loadSettingsOpen, setLoadSettingsOpen] = useState(false);

  return (
    <AdminPageLayout
      title="Apps"
      description="Setup and guides for the Office, Driver, Load Reports and Banksman apps"
    >
      <Tabs defaultValue={/Mobi|Android|iPhone/i.test(navigator.userAgent) ? "banksman" : "office"} className="space-y-6">
        <TabsList>
          <TabsTrigger value="office" className="gap-2">
            <Building2 className="w-4 h-4" /> Office App
          </TabsTrigger>
          <TabsTrigger value="driver" className="gap-2">
            <Truck className="w-4 h-4" /> Driver App
          </TabsTrigger>
          <TabsTrigger value="load-reports" className="gap-2">
            <FileText className="w-4 h-4" /> Load Reports
          </TabsTrigger>
          <TabsTrigger value="banksman" className="gap-2">
            <HardHat className="w-4 h-4" /> Banksman App
          </TabsTrigger>
        </TabsList>

        {/* Office App */}
        <TabsContent value="office" className="space-y-6">
          <OfficeAppInstallCard />
          <AppGuide
            overview="The Office App is a home screen for the office team. Each person unlocks it with their own username and PIN and gets one-tap access to the everyday office tools: diary, load reports, stock, weighbridge and health & safety."
            badges={[
              { icon: Key, label: "Username + PIN" },
              { icon: Lock, label: "Lock between users" },
              { icon: Shield, label: "Section Visibility applies" },
              { icon: RefreshCw, label: "Always latest version" },
            ]}
            steps={officeSteps}
            features={officeFeatures}
            extra={
              <div className="flex flex-wrap gap-2">
                <LaunchButton url="/office" label="Open Office App" />
              </div>
            }
          />
        </TabsContent>

        {/* Driver App */}
        <TabsContent value="driver">
          <AppGuide
            overview="The RouteOne Driver App is a standalone, mobile-first Progressive Web App (PWA) designed for outdoor operational use. Drivers authenticate with a PIN-based login and manage their daily job assignments directly from their phone or tablet."
            badges={[
              { icon: Shield, label: "PIN Authentication" },
              { icon: Camera, label: "Photo Capture" },
              { icon: MapPin, label: "Google Maps" },
              { icon: AlertTriangle, label: "Contamination Reports" },
              { icon: Wifi, label: "PWA / Offline" },
            ]}
            steps={driverSteps}
            features={driverFeatures}
            extra={
              <div className="flex flex-wrap gap-2">
                <LaunchButton url="https://clewshandbook.lovable.app/driver" label="Open Driver App" />
              </div>
            }
          />
        </TabsContent>

        {/* Load Reports */}
        <TabsContent value="load-reports" className="space-y-6">
          <LoadReportsInstallCard />
          <AppGuide
            overview="Load Reports lets yard operators tally inbound and outbound loads, calculate accurate tonnages from configurable weights, and produce load reports and certificates of destruction for customers."
            badges={[
              { icon: Package, label: "Load Tallying" },
              { icon: Scale, label: "Weight Calculation" },
              { icon: FileText, label: "Reports & Certificates" },
              { icon: Wifi, label: "Offline Support" },
            ]}
            steps={loadReportSteps}
            features={loadReportFeatures}
            extra={
              <div className="flex flex-wrap gap-2">
                <LaunchButton url="https://clewshandbook.lovable.app/load-reports" label="Open Load Reports" />
                <Button onClick={() => setLoadSettingsOpen(true)} className="gap-2">
                  <Settings className="w-4 h-4" /> Configure Waste Types & Weights
                </Button>
              </div>
            }
          />
          <LoadReportSettings open={loadSettingsOpen} onOpenChange={setLoadSettingsOpen} />
        </TabsContent>

        {/* Banksman App */}
        <TabsContent value="banksman" className="space-y-6">
          <BanksmanInstallCard />
          <BanksmanAppGuide />
        </TabsContent>
      </Tabs>
    </AdminPageLayout>
  );
};

export default AdminAppsPage;
