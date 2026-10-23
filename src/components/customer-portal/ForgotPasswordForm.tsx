import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withTimeout } from "@/lib/with-timeout";
import { recoveryRedirectUrl } from "@/lib/password-recovery";
import { Loader2 } from "lucide-react";

export function ForgotPasswordForm({ initialEmail = "", onBack }: { initialEmail?: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <form className="space-y-4" onSubmit={async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await withTimeout(supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: recoveryRedirectUrl(window.location.origin),
      }), 15000, "Password reset");
      if (result.error) throw result.error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't request a reset. Please try again.");
    } finally { setBusy(false); }
  }}>
    {sent ? <p role="status" className="text-sm text-foreground">If an account exists for that email, a reset link has been requested. Check your inbox and spam folder.</p> : <>
      <div className="space-y-2"><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send reset link</Button>
    </>}
    <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={busy}>Back to sign in</Button>
  </form>;
}