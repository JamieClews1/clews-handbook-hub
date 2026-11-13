import { useEffect, useState } from "react";
import packageJson from "../../../package.json";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Copy, Download, Share } from "lucide-react";
import { detectInstallBrowser, type InstallBrowser } from "@/lib/load-reports-app";
import { OFFICE_APP_PATH, OFFICE_APP_TILES } from "@/lib/office-app";

const OFFICE_APP_URL = `https://portal.clewsrecycling.co.uk${OFFICE_APP_PATH}`;

/** Download/install card for the Office App, matching the other app cards in Admin → Apps. */
export function OfficeAppInstallCard() {
  const [browser, setBrowser] = useState<InstallBrowser>("desktop");
  const [copied, setCopied] = useState(false);
  useEffect(
    () => setBrowser(detectInstallBrowser(navigator.userAgent, navigator.maxTouchPoints, navigator.platform)),
    [],
  );

  return (
    <Card className="border-2 border-primary/40">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <img src="/w1-icon-192.png" alt="W1 app icon" className="h-14 w-14 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">Office App</h2>
            <p className="text-muted-foreground">
              One home screen for the office team, opening the everyday tools with a username and PIN.
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm">
              Version {packageJson.version}
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                <CheckCircle2 className="h-4 w-4" /> Up to date
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Installed devices update automatically every time the app opens.
            </p>
          </div>
          <Button asChild size="lg" className="gap-2 font-bold">
            <a href={OFFICE_APP_PATH} target="_blank" rel="noopener noreferrer">
              <Download className="h-5 w-5" /> OPEN OFFICE APP
            </a>
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">What's in it</p>
          <div className="flex flex-wrap gap-2">
            {OFFICE_APP_TILES.map((t) => (
              <Badge key={t.path} variant="secondary">{t.label}</Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
          <p>Open this link on the office PC, tablet or phone, or send it to the person:</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-background px-2 py-1">{OFFICE_APP_URL}</code>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                navigator.clipboard.writeText(OFFICE_APP_URL);
                setCopied(true);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {browser === "ios" ? (
            <p>
              <b>iPhone / iPad:</b> in <b>Safari</b> tap <Share className="inline h-4 w-4" /> <b>Share</b> →{" "}
              <b>Add to Home Screen</b> → <b>Add</b>.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Easiest: open the Office App and tap <b>Add to home screen</b> — it shows the right steps for that
              device. Samsung Internet: ☰ menu (bottom right) → Add page to → Home screen. Chrome: ⋮ (top right) → Add
              to Home screen. If the link opened inside Outlook, Gmail or WhatsApp there is no menu — open it in Chrome
              first.
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Access: office staff. Each person signs in once per device with their portal password, then uses their
          username and PIN. Starting PIN is 1234 and must be changed on first use; reset a forgotten PIN in Admin →
          Users.
        </p>
      </CardContent>
    </Card>
  );
}
