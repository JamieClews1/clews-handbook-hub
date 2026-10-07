import { useEffect, useState } from "react";
import packageJson from "../../../package.json";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, HardHat, Share, MoreVertical, Copy } from "lucide-react";

const URL_ = "https://clewshandbook.lovable.app/banksman";
type Device = "ios" | "android" | "desktop";

function detect(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** Download/install card for the Banksman App with device-specific instructions. */
export function BanksmanInstallCard() {
  const [device, setDevice] = useState<Device>("desktop");
  const [copied, setCopied] = useState(false);
  useEffect(() => setDevice(detect()), []);

  return (
    <Card className="border-2 border-primary/40">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15"><HardHat className="h-8 w-8 text-primary" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">Banksman App</h2>
            <p className="text-muted-foreground">Mobile app for banksmen to manage jobs, photograph loads and record contamination.</p>
            <p className="mt-2 flex items-center gap-2 text-sm">Version {packageJson.version}
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Up to date</span></p>
            <p className="text-xs text-muted-foreground">Installed phones update automatically every time the app opens — no manual update needed.</p>
          </div>
          <Button asChild size="lg" className="gap-2 font-bold">
            <a href="/banksman" target="_blank" rel="noopener noreferrer"><Download className="h-5 w-5" /> DOWNLOAD BANKSMAN APP</a>
          </Button>
        </div>

        <div className="rounded-lg bg-muted p-4 text-sm">
          {device === "ios" && <p><b>iPhone:</b> tap Download, then in Safari tap <Share className="inline h-4 w-4" /> <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>.</p>}
          {device === "android" && <p><b>Android:</b> tap Download, then in Chrome tap <MoreVertical className="inline h-4 w-4" /> → <b>Install app</b> (or <b>Add to Home screen</b>).</p>}
          {device === "desktop" && <div className="space-y-2">
            <p>Open this page on the banksman's phone, or send them the link:</p>
            <div className="flex flex-wrap items-center gap-2"><code className="rounded bg-background px-2 py-1">{URL_}</code>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => { navigator.clipboard.writeText(URL_); setCopied(true); }}><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy"}</Button></div>
            <p className="text-muted-foreground">iPhone: Safari → Share → Add to Home Screen. Android: Chrome → ⋮ → Install app.</p>
          </div>}
        </div>
        <p className="text-sm text-muted-foreground">Access: only active yard staff with a username and PIN can sign in. Manage them in WeighOne → Banksman App → Yard Staff.</p>
      </CardContent>
    </Card>
  );
}
