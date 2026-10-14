import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share, MoreVertical, Copy, Truck, X } from "lucide-react";

const URL_ = "https://clewshandbook.lovable.app/load-reports";
type Device = "ios" | "android" | "desktop";

function detect(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** Install card for the Load Reports app with device-specific instructions. */
export function LoadReportsInstallCard({ onDismiss }: { onDismiss?: () => void }) {
  const [device, setDevice] = useState<Device>("desktop");
  const [copied, setCopied] = useState(false);
  useEffect(() => setDevice(detect()), []);

  return (
    <Card className="border-2 border-primary/40">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">Add Load Reports to your phone</h2>
            <p className="text-sm text-muted-foreground">
              Put a Load Reports icon on the home screen so it opens like an app, full screen, with no browser bar.
            </p>
          </div>
          <Button asChild size="lg" className="gap-2 font-bold">
            <a href={URL_} target="_blank" rel="noopener noreferrer">
              <Download className="h-5 w-5" /> OPEN LOAD REPORTS
            </a>
          </Button>
          {onDismiss && (
            <Button variant="ghost" size="icon" aria-label="Dismiss install tip" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="rounded-lg bg-muted p-4 text-sm">
          {device === "ios" && (
            <p>
              <b>iPhone:</b> open Load Reports in <b>Safari</b>, sign in, then tap <Share className="inline h-4 w-4" />{" "}
              <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>.
            </p>
          )}
          {device === "android" && (
            <p>
              <b>Android:</b> open Load Reports in <b>Chrome</b>, sign in, then tap <MoreVertical className="inline h-4 w-4" /> →{" "}
              <b>Install app</b> (or <b>Add to Home screen</b>).
            </p>
          )}
          {device === "desktop" && (
            <div className="space-y-2">
              <p>Open this page on the phone, or send the link to the person who needs it:</p>
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
                iPhone: Safari → Share → Add to Home Screen. Android: Chrome → ⋮ → Install app. Sign in first, and the
                icon will open straight back into Load Reports.
              </p>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Needs a staff account — Load Reports is only open to signed-in staff, so do the sign-in before adding the
          icon.
        </p>
      </CardContent>
    </Card>
  );
}
