import { useEffect, useState } from "react";
import packageJson from "../../../package.json";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Share, MoreVertical, Copy, Truck, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const URL_ = "https://clewshandbook.lovable.app/load-reports";
type Device = "ios" | "android" | "desktop";

function detect(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

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
  const [device, setDevice] = useState<Device>("desktop");
  const [copied, setCopied] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  useEffect(() => setDevice(detect()), []);

  const oneTap = installHere && canInstall;

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
            ) : installHere ? null : (
              <Button asChild size="lg" className="gap-2 font-bold">
                <a href="/load-reports" target="_blank" rel="noopener noreferrer">
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
          {device === "ios" && (
            <p>
              <b>iPhone:</b> {installHere ? "in" : "tap Download, then in"} <b>Safari</b> tap{" "}
              <Share className="inline h-4 w-4" /> <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>.
            </p>
          )}
          {device === "android" && (
            <p>
              <b>Android:</b>{" "}
              {oneTap
                ? "tap Install above, then Install again to confirm."
                : <>{installHere ? "in" : "tap Download, then in"} <b>Chrome</b> tap <MoreVertical className="inline h-4 w-4" /> → <b>Install app</b> (or <b>Add to Home screen</b>).</>}
            </p>
          )}
          {device === "desktop" && (
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
                iPhone: Safari → Share → Add to Home Screen. Android: Chrome → ⋮ → Install app.
              </p>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Access: signed-in staff only. Sign in once on the phone before adding the icon, and it will open straight
          back into Load Reports.
        </p>
      </CardContent>
    </Card>
  );
}
