import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/customer-portal/ForgotPasswordForm";
import { isRecoveryHash, validateRecoveryPassword } from "@/lib/password-recovery";
import { withTimeout } from "@/lib/with-timeout";
import w1Logo from "@/assets/w1-logo.png";

export default function ResetPasswordPage() {
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [request, setRequest] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const recovery = isRecoveryHash(window.location.hash) || sessionStorage.getItem("password-recovery") === "true";
        const { data, error } = await withTimeout(supabase.auth.getUser(), 12000, "Reset link check");
        if (active) setState(recovery && data.user && !error ? "ready" : "invalid");
      } catch { if (active) setState("invalid"); }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem("password-recovery", "true");
        setTimeout(check, 0);
      }
    });
    void check();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <div className="min-h-screen bg-background flex items-center justify-center p-4"><div className="w-full max-w-md">
    <img src={w1Logo} alt="WasteOne" className="h-16 w-auto mx-auto mb-8" />
    <Card><CardHeader><CardTitle>Reset your password</CardTitle></CardHeader><CardContent className="space-y-4">
      {state === "checking" && <p role="status">Checking your reset link…</p>}
      {state === "invalid" && (request ? <ForgotPasswordForm onBack={() => setRequest(false)} /> : <><p role="alert">This reset link is missing, expired or has already been used.</p><Button className="w-full" onClick={() => setRequest(true)}>Request a new reset link</Button><Button asChild variant="ghost" className="w-full"><Link to="/my-portal">Back to sign in</Link></Button></>)}
      {state === "ready" && <form className="space-y-4" onSubmit={async e => {
        e.preventDefault();
        const validation = validateRecoveryPassword(password, confirmation);
        if (validation) { setError(validation); return; }
        setBusy(true); setError(null);
        try {
          const { error } = await withTimeout(supabase.auth.updateUser({ password }), 15000, "Password update");
          if (error) throw error;
          sessionStorage.removeItem("password-recovery");
          setPassword(""); setConfirmation(""); setState("done");
        } catch (err) { setError(err instanceof Error ? err.message : "Couldn't update your password. Please try again."); }
        finally { setBusy(false); }
      }}>
        <div className="space-y-2"><Label htmlFor="recovery-password">New password</Label><Input id="recovery-password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
        <div className="space-y-2"><Label htmlFor="recovery-confirmation">Confirm new password</Label><Input id="recovery-confirmation" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
      </form>}
      {state === "done" && <><p role="status">Your password has been updated.</p><Button asChild className="w-full"><Link to="/my-portal">Open customer portal</Link></Button></>}
    </CardContent></Card>
  </div></div>;
}