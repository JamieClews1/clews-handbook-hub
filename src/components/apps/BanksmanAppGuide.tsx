import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Globe,
  Key,
  Truck,
  Camera,
  AlertTriangle,
  CheckCircle,
  Shield,
  Scale,
  Weight,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

type Step = { number: number; title: string; icon: typeof Globe; content: React.ReactNode };
type Feature = { icon: typeof Globe; title: string; description: string };

const UrlBox = ({ url }: { url: string }) => (
  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-sm break-all">
    <Globe className="w-4 h-4 shrink-0 text-primary" />
    {url}
  </div>
);

const banksmanSteps: Step[] = [
  {
    number: 1,
    title: "Access the Banksman App",
    icon: Globe,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The Banksman App is a mobile-first web app for the weighbridge, accessible at:
        </p>
        <UrlBox url="https://clewshandbook.lovable.app/banksman" />
        <p className="text-sm text-muted-foreground">
          Open in <strong>Google Chrome</strong> on the weighbridge tablet or phone, then add it to
          the home screen for quick access.
        </p>
      </div>
    ),
  },
  {
    number: 2,
    title: "Set Up Yard Staff Logins",
    icon: Key,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The banksman logs in with a <strong>Username</strong> and <strong>PIN</strong> from the
          Yard Staff list below.
        </p>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Use the <strong>Yard Staff</strong> tab to add the banksman with a unique <strong>Username</strong></li>
          <li>Set a <strong>4–6 digit PIN</strong></li>
          <li>Ensure the staff member is marked as <strong>Active</strong></li>
        </ol>
      </div>
    ),
  },
  {
    number: 3,
    title: "Confirm the Weighbridge Feed",
    icon: Scale,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The live feed shows jobs coming through the weighbridge (Midweigh). Where a Skiptrak ticket
          matches the same vehicle and date, both the <strong>Midweigh</strong> and{" "}
          <strong>Skiptrak</strong> job numbers are shown on the card.
        </p>
        <p className="text-sm text-muted-foreground">
          Make sure Midweigh and Skiptrak data is syncing in the Data Hub so jobs appear in the feed.
        </p>
      </div>
    ),
  },
  {
    number: 4,
    title: "Capture Contaminations",
    icon: Camera,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Tapping a job opens the contamination flow — the banksman takes photos and assigns the waste
          type, contamination percentage and sorting time. Reported jobs show a "Reported" badge and
          can be re-opened to edit.
        </p>
      </div>
    ),
  },
];

const banksmanFeatures: Feature[] = [
  { icon: RefreshCw, title: "Live Weighbridge Feed", description: "Auto-refreshing list of Midweigh jobs coming across the weighbridge." },
  { icon: Truck, title: "Dual Job Numbers", description: "Shows both the Midweigh and matched Skiptrak job number for each ticket." },
  { icon: Camera, title: "Photo & Contamination Capture", description: "Take photos and assign contamination type, percentage and sorting minutes." },
  { icon: Weight, title: "Weights in Tonnes", description: "Midweigh weights are normalised to tonnes for consistent reporting." },
  { icon: CheckCircle, title: "Reported Tracking", description: "Already-reported jobs are flagged and remain editable." },
  { icon: Key, title: "Username Authentication", description: "Yard staff sign in securely with a username and PIN." },
];

const banksmanBadges = [
  { icon: Shield, label: "PIN Authentication" },
  { icon: Scale, label: "Weighbridge Feed" },
  { icon: Truck, label: "Midweigh + Skiptrak" },
  { icon: Camera, label: "Contamination Capture" },
];

const overview =
  "The Banksman App is a mobile-first web app for the weighbridge. Yard staff sign in with a PIN to see a live feed of jobs crossing the weighbridge, then take photos and record contamination details against each job.";

export const BanksmanAppGuide = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Overview</CardTitle>
        <CardDescription>{overview}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {banksmanBadges.map((b) => (
            <Badge key={b.label} variant="secondary" className="gap-1">
              <b.icon className="w-3 h-3" /> {b.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>

    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="gap-2">
        <a href="https://clewshandbook.lovable.app/banksman" target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-4 h-4" /> Open Banksman App
        </a>
      </Button>
    </div>

    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Setup Steps</h2>
      {banksmanSteps.map((step) => (
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
        {banksmanFeatures.map((feature) => (
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
