import { useEffect, useState } from "react";
import { Download, ExternalLink, Menu, MoreVertical, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInstallPrompt, isStandaloneDisplay } from "@/hooks/useInstallPrompt";
import { chromeIntentUrl, detectInstallBrowser, isInAppBrowser, type InstallBrowser } from "@/lib/load-reports-app";

/**
 * "Add to home screen" for an installable app page. Uses the browser's one-tap install when offered,
 * otherwise shows steps for this phone's browser — including Samsung Internet (menu at the bottom) and
 * in-app viewers (Outlook, WhatsApp…) that have no menu at all and must hand over to Chrome.
 */
export function AddToHomeScreenButton({ appName, path, className, variant = "default" }: { appName: string; path: string; className?: string; variant?: "default" | "outline" }) {
  const { canInstall, install } = useInstallPrompt();
  const [browser, setBrowser] = useState<InstallBrowser>("desktop");
  const [inApp, setInApp] = useState(false);
  const [framed, setFramed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setBrowser(detectInstallBrowser(navigator.userAgent, navigator.maxTouchPoints, navigator.platform));
    setInApp(isInAppBrowser(navigator.userAgent));
    let inFrame = false;
    try {
      inFrame = window.self !== window.top;
    } catch {
      inFrame = true;
    }
    setFramed(inFrame);
  }, []);

  if (isStandaloneDisplay()) return null;
  const onPhone = browser !== "desktop";
  if (!onPhone && !canInstall) return null;
  const appUrl = `${window.location.origin}${path}`;

  const onClick = async () => {
    if (canInstall && (await install())) return;
    setOpen(true);
  };
  const android = browser === "samsung" || browser === "chrome" || browser === "other-android";

  return (
    <>
      <Button variant={variant} onClick={() => void onClick()} className={`gap-2 ${className ?? ""}`}>
        <Download className="h-4 w-4" />
        {onPhone ? "Add to home screen" : `Install ${appName}`}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {appName} to your home screen</DialogTitle>
            <DialogDescription>You'll get a W1 icon that opens straight into the {appName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {framed ? (
              <div className="space-y-3">
                <p>
                  This page is showing inside another page (such as the Lovable preview), so your phone can only add
                  that outer page. Open the {appName} on its own first:
                </p>
                <Button asChild className="w-full gap-2">
                  <a href={android ? chromeIntentUrl(window.location.host, path) : appUrl} target="_top" rel="noopener">
                    <ExternalLink className="h-4 w-4" /> Open the {appName} on its own
                  </a>
                </Button>
                <p className="text-muted-foreground">
                  Or scan the QR code in Admin → Apps with the phone camera. Then tap Add to home screen again.
                </p>
              </div>
            ) : inApp && android ? (
              <div className="space-y-3">
                <p>
                  This page has opened inside another app (such as Outlook, Gmail or WhatsApp), which can't add icons.
                  Open it in Chrome first:
                </p>
                <Button asChild className="w-full gap-2">
                  <a href={chromeIntentUrl(window.location.host, path)}>
                    <ExternalLink className="h-4 w-4" /> Open in Chrome
                  </a>
                </Button>
                <p className="text-muted-foreground">Then tap Add to home screen again.</p>
              </div>
            ) : browser === "ios" ? (
              <ol className="list-decimal space-y-2 pl-5">
                <li>Make sure you're in <b>Safari</b>.</li>
                <li>Tap <Share className="inline h-4 w-4" /> <b>Share</b> (bottom of the screen).</li>
                <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
              </ol>
            ) : browser === "samsung" ? (
              <ol className="list-decimal space-y-2 pl-5">
                <li>Tap the <Menu className="inline h-4 w-4" /> <b>menu</b> — three lines at the <b>bottom right</b>.</li>
                <li>Tap <b>Add page to</b> → <b>Home screen</b>.</li>
                <li>Tap <b>Add</b>.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5">
                <li>Tap <MoreVertical className="inline h-4 w-4" /> — three dots at the <b>top right</b> (next to the address).</li>
                <li>Tap <b>Add to Home screen</b> (or <b>Install app</b>).</li>
                <li>Tap <b>Install</b> or <b>Add</b>.</li>
              </ol>
            )}
            {android && !inApp && !framed && (
              <div className="space-y-2 rounded-md bg-muted p-3">
                <p className="text-muted-foreground">
                  Can't see a menu? The page may be open inside another app. Open it in Chrome instead:
                </p>
                <Button asChild variant="outline" size="sm" className="gap-1">
                  <a href={chromeIntentUrl(window.location.host, path)}>
                    <ExternalLink className="h-3.5 w-3.5" /> Open in Chrome
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground">
                  If the menu says <b>Open in app</b>, a WasteOne icon already covers the portal on this phone: press and
                  hold it → Uninstall, then try again.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
