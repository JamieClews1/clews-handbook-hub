import { useEffect, useState } from "react";
import packageJson from "../../../package.json";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Share, MoreVertical, Menu, Copy, Truck, X, ExternalLink } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { chromeIntentUrl, detectInstallBrowser, type InstallBrowser } from "@/lib/load-reports-app";

const URL_ = "https://portal.clewsrecycling.co.uk/load-reports?app=load-reports";

/**
 * Download/install card for the Load Reports app, matching the Banksman App card.
 * `installHere` = the Load Reports manifest is active on this page, so Chrome's
 * one-tap install (when offered) installs Load Reports itself.
 */
export function LoadReportsInstallCard({
  onDismiss,
  installHere = false,
}: {
  onDismiss?: () => void;
  installHere?: boolean;
}) {
  const [browser, setBrowser] = useState<InstallBrowser>("desktop");
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  useEffect(
    () => setBrowser(detectInstallBrowser(navigator.userAgent, navigator.maxTouchPoints, navigator.platform)),
    [],
  );

  const oneTap = installHere && canInstall;
  const onPhone = browser !== "desktop";
  const android = browser === "samsung" || browser === "chrome" || browser === "other-android";

  return (
    <Card className="border-2 border-primary/40">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">Load Reports App</h2>
            <p className="text-muted-foreground">
              Phone and tablet app for the yard to tally loads, weigh pallets and complete load reports.
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm">
              Version {packageJson.version}
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                <CheckCircle2 className="h-4 w-4" /> Up to date
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Installed phones update automatically every time the app opens — no manual update needed.
            </p>
          </div>
          <div className="flex items-start gap-1">
            {oneTap ? (
              <Button size="lg" className="gap-2 font-bold" onClick={() => void install()}>
                <Download className="h-5 w-5" /> INSTALL LOAD REPORTS APP
              </Button>
            ) : installHere && onPhone ? (
              <Button size="lg" className="gap-2 font-bold" onClick={() => setShowSteps(true)}>
                <Download className="h-5 w-5" /> ADD TO HOME SCREEN
              </Button>
            ) : installHere ? null : (
              <Button asChild size="lg" className="gap-2 font-bold">
                <a href="/load-reports?app=load-reports" target="_blank" rel="noopener noreferrer">
                  <Download className="h-5 w-5" /> DOWNLOAD LOAD REPORTS APP
                </a>
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" size="icon" aria-label="Hide download tip" onClick={onDismiss}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-muted p-4 text-sm">
          {browser === "ios" && (
            <p>
              <b>iPhone:</b> {installHere ? "in" : "tap Download, then in"} <b>Safari</b> tap{" "}
              <Share className="inline h-4 w-4" /> <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>.
            </p>
          )}
          {android && oneTap && <p><b>Android:</b> tap Install above, then Install again to confirm.</p>}
          {android && !oneTap && (
            <div className={showSteps ? "space-y-2 rounded-md p-2 ring-2 ring-primary" : "space-y-2"}>
              {!installHere && <p>Tap Download first, then on the Load Reports page:</p>}
              {browser === "samsung" ? (
                <ol className="list-decimal space-y-1 pl-5">
                  <li>
                    Tap the <Menu className="inline h-4 w-4" /> <b>menu</b> (three lines, bottom right).
                  </li>
                  <li>
                    Tap <b>Add page to</b> → <b>Home screen</b>.
                  </li>
                  <li>
                    Tap <b>Add</b> (or <b>Install</b>).
                  </li>
                </ol>
              ) : (
                <ol className="list-decimal space-y-1 pl-5">
                  <li>
                    Tap <MoreVertical className="inline h-4 w-4" /> (three dots, top right).
                  </li>
                  <li>
                    Tap <b>Add to Home screen</b> (or <b>Install app</b>).
                  </li>
                  <li>
                    Tap <b>Install</b> (or <b>Add</b>).
                  </li>
                </ol>
              )}
              {browser !== "chrome" && installHere && (
                <Button asChild variant="outline" size="sm" className="gap-1">
                  <a href={chromeIntentUrl(window.location.host)}>
                    <ExternalLink className="h-3.5 w-3.5" /> Or open in Chrome instead
                  </a>
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                If the menu says <b>Open in app</b> instead, this phone already has a WasteOne or WeighOne icon
                covering the whole portal. Remove that icon (press and hold → Uninstall), reopen this page and try again.
              </p>
            </div>
          )}
          {browser === "desktop" && (
            <div className="space-y-2">
              <p>Open this page on the yard phone or tablet, or send the link:</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-background px-2 py-1">{URL_}</code>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(URL_);
                    setCopied(true);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-muted-foreground">
                iPhone: Safari → Share → Add to Home Screen. Samsung: ☰ menu → Add page to → Home screen.
                Chrome: ⋮ → Add to Home screen.
              </p>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Access: signed-in staff only. Sign in once on the phone before adding the icon. The installed app opens
          straight into Load Reports and can only show Load Reports — no other portal pages.
        </p>
      </CardContent>
    </Card>
  );
}
