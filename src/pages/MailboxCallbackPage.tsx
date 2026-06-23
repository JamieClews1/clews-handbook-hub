import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function MailboxCallbackPage() {
  const navigate = useNavigate();
  const ran = useRef(false);
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Linking your mailbox…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const isPopup = !!window.opener && window.opener !== window;

    const finish = (
      result:
        | { status: "connected"; email?: string }
        | { status: "error"; reason: string },
    ) => {
      if (isPopup) {
        try {
          window.opener.postMessage(
            { type: "crm-mailbox-oauth", ...result },
            window.location.origin,
          );
        } catch {
          /* ignore */
        }
        setStatus(result.status === "connected" ? "done" : "error");
        setMessage(
          result.status === "connected"
            ? "Mailbox linked! You can close this window."
            : "Sign-in failed. You can close this window.",
        );
        setTimeout(() => {
          try { window.close(); } catch { /* ignore */ }
        }, 800);
        return;
      }
      // Not a popup — navigate back to the CRM page.
      if (result.status === "connected") {
        navigate(
          `/crm?mailbox=connected${result.email ? `&email=${encodeURIComponent(result.email)}` : ""}`,
          { replace: true },
        );
      } else {
        navigate(`/crm?mailbox=error&reason=${encodeURIComponent(result.reason)}`, {
          replace: true,
        });
      }
    };

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error_description") || params.get("error");
      const code = params.get("code");
      const state = params.get("state");

      if (oauthError) {
        setStatus("error");
        finish({ status: "error", reason: oauthError });
        return;
      }
      if (!code || !state) {
        setStatus("error");
        finish({ status: "error", reason: "Missing authorization code" });
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/crm/mailbox-callback`;
        const { data, error } = await supabase.functions.invoke("crm-mailbox-callback", {
          body: { code, state, redirectUri },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setStatus("done");
        setMessage("Mailbox linked!");
        finish({ status: "connected", email: data?.email });
      } catch (e: any) {
        setStatus("error");
        finish({ status: "error", reason: e?.message ?? String(e) });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="p-8 flex flex-col items-center gap-3 text-center max-w-md">
        {status === "working" && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
        {status === "done" && <CheckCircle2 className="h-8 w-8 text-emerald-600" />}
        {status === "error" && <AlertCircle className="h-8 w-8 text-destructive" />}
        <p className="text-sm text-muted-foreground">{message}</p>
      </Card>
    </div>
  );
}
