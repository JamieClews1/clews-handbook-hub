import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

/** Portal-wide full-screen: browser full screen + sidebar collapsed to icons. */
export function FullScreenToggle() {
  const { setOpen } = useSidebar();
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const active = !!document.fullscreenElement;
      setFs(active);
      setOpen(!active);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [setOpen]);

  const toggle = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      setFs(false);
      setOpen(true);
    } else {
      setFs(true);
      setOpen(false);
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground"
      onClick={toggle}
      title={fs ? "Exit full screen" : "Full screen"}
      aria-label={fs ? "Exit full screen" : "Full screen"}
    >
      {fs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </Button>
  );
}
