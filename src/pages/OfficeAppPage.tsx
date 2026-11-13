import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock, LogOut, KeyRound, LayoutDashboard, MoreVertical, ChevronRight, UserRound } from "lucide-react";
import { AddToHomeScreenButton } from "@/components/apps/AddToHomeScreenButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePortalSectionVisibility } from "@/hooks/usePortalSectionVisibility";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { useCompanyPlAccess } from "@/hooks/useCompanyPlAccess";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { usernameToEmail, emailToUsername } from "@/lib/auth-utils";
import {
  OFFICE_APP_TILES, visibleOfficeTiles, officeTileIcon, newPinProblem, normaliseOfficeUsername,
  isOfficeLocked, setOfficeLocked, setOfficeMode, rememberedPeople, rememberPerson, forgetPerson,
} from "@/lib/office-app";
import { officePinCall } from "@/lib/office-app-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { withTimeout } from "@/lib/with-timeout";

function useOfficeAppChrome() {
  useEffect(() => {
    setOfficeMode(true);
    const prevTitle = document.title;
    document.title = "Office App · WasteOne";
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prev = link?.getAttribute("href");
    if (link) link.setAttribute("href", "/manifest-office.webmanifest");
    return () => {
      document.title = prevTitle;
      if (link && prev) link.setAttribute("href", prev);
    };
  }, []);
}

async function rememberCurrentSession(name: string | null) {
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s?.user?.email || !s.refresh_token) return;
  rememberPerson({ userId: s.user.id, username: emailToUsername(s.user.email), name, refreshToken: s.refresh_token });
}

/* ─── Unlock: username + PIN, first-time PIN change, first-time-on-device password ─── */
function UnlockScreen({ currentUserId, onUnlocked }: { currentUserId: string | null; onUnlocked: () => void }) {
  const navigate = useNavigate();
  const people = useMemo(() => rememberedPeople(), []);
  const [step, setStep] = useState<"pin" | "new-pin" | "password">("pin");
  const [username, setUsername] = useState(people.length === 1 ? people[0].username : "");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState<{ userId: string; name: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (userId: string, name: string | null) => {
    if (currentUserId === userId) { await rememberCurrentSession(name); onUnlocked(); return; }
    const saved = rememberedPeople().find((p) => p.userId === userId);
    if (saved) {
      try {
        const { data, error: refreshError } = await withTimeout(
          supabase.auth.refreshSession({ refresh_token: saved.refreshToken }), 15000, "Session restore",
        );
        if (!refreshError && data.session?.user.id === userId) {
          rememberPerson({ ...saved, name, refreshToken: data.session.refresh_token });
          onUnlocked();
          return;
        }
      } catch {
        setError("Signing in is taking too long. Check the signal and try again.");
        return;
      }
      forgetPerson(userId);
    }
    setVerified({ userId, name });
    setStep("password");
  };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const u = normaliseOfficeUsername(username);
    if (!u || !pin) return;
    setBusy(true);
    const res = await officePinCall({ action: "verify", username: u, pin });
    setBusy(false);
    if (res.needs_new_pin) { setStep("new-pin"); return; }
    if (res.error || !res.user_id) {
      setError(res.attempts_left && res.attempts_left <= 2 ? `${res.error} ${res.attempts_left} ${res.attempts_left === 1 ? "try" : "tries"} left before it locks.` : res.error ?? "Username or PIN not recognised.");
      setPin("");
      return;
    }
    setBusy(true);
    await finish(res.user_id, res.name ?? null);
    setBusy(false);
  };

  const submitNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = newPinProblem(newPin, confirmPin);
    if (problem) { setError(problem); return; }
    setError(null);
    setBusy(true);
    const res = await officePinCall({ action: "verify", username: normaliseOfficeUsername(username), pin, new_pin: newPin });
    setBusy(false);
    if (res.error || !res.user_id) { setError(res.error ?? "Could not save your PIN."); return; }
    setPin(newPin);
    setBusy(true);
    await finish(res.user_id, res.name ?? null);
    setBusy(false);
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verified || !password) return;
    setError(null);
    setBusy(true);
    let result: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
    try {
      result = await withTimeout(supabase.auth.signInWithPassword({ email: usernameToEmail(username), password }), 15000, "Sign in");
    } catch {
      setBusy(false);
      setError("Signing in is taking too long. Check the signal and try again.");
      return;
    }
    const { data, error: signInError } = result;
    if (signInError || !data.session) { setBusy(false); setError("That password isn't right. Use the password you sign into the portal with."); return; }
    if (data.user.id !== verified.userId) { setBusy(false); setError("That password belongs to a different account."); return; }
    rememberPerson({ userId: data.user.id, username: normaliseOfficeUsername(username), name: verified.name, refreshToken: data.session.refresh_token });
    setBusy(false);
    onUnlocked();
  };

  const leaveOfficeApp = async () => {
    await supabase.auth.signOut();
    setOfficeLocked(false);
    setOfficeMode(false);
    navigate("/auth");
  };

  const pinInput = (id: string, value: string, set: (v: string) => void, autoFocus = false, label = "PIN") => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" inputMode="numeric" autoComplete="off" pattern="\d*" maxLength={6} autoFocus={autoFocus}
        value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ""))} className="h-14 text-center text-2xl tracking-[0.5em]" />
    </div>
  );

  return (
    <div className="min-h-dvh bg-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-lg" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Office App</h1>
            <p className="text-sm text-muted-foreground">
              {step === "pin" && "Sign in with your username and PIN"}
              {step === "new-pin" && "Choose your own PIN"}
              {step === "password" && "First time on this device"}
            </p>
          </div>
        </div>

        {step === "pin" && (
          <form onSubmit={submitPin} className="space-y-4">
            {people.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="People on this device">
                {people.map((p) => (
                  <Button key={p.userId} type="button" size="sm" variant={normaliseOfficeUsername(username) === p.username ? "default" : "outline"}
                    onClick={() => { setUsername(p.username); setPin(""); setError(null); }} className="gap-1.5">
                    <UserRound className="h-4 w-4" />{p.name?.split(" ")[0] || p.username}
                  </Button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="office-username">Username</Label>
              <Input id="office-username" autoCapitalize="none" autoCorrect="off" autoComplete="username" spellCheck={false}
                value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 text-lg" placeholder="e.g. laurac" />
              <p className="text-xs text-muted-foreground">The first part of your work email, before the @.</p>
            </div>
            {pinInput("office-pin", pin, setPin, people.length === 1)}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-12 text-base" disabled={busy || !username.trim() || pin.length < 4}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">First time? Your starting PIN is 1234. You'll choose your own straight after.</p>
          </form>
        )}

        {step === "new-pin" && (
          <form onSubmit={submitNewPin} className="space-y-4">
            <p className="text-sm text-muted-foreground">You're still on the starting PIN. Pick a 4-digit PIN only you know. It can't be 1234.</p>
            {pinInput("office-new-pin", newPin, setNewPin, true, "New PIN")}
            {pinInput("office-confirm-pin", confirmPin, setConfirmPin, false, "Type it again")}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-12 text-base" disabled={busy || newPin.length < 4 || confirmPin.length < 4}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save my PIN"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("pin"); setNewPin(""); setConfirmPin(""); setPin(""); setError(null); }}>Back</Button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={submitPassword} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your PIN is right{verified?.name ? `, ${verified.name.split(" ")[0]}` : ""}. Enter your normal portal password once so this device remembers you. Next time your PIN is enough.
            </p>
            <div className="space-y-2">
              <Label htmlFor="office-password">Portal password</Label>
              <Input id="office-password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-lg" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-12 text-base" disabled={busy || !password}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("pin"); setPassword(""); setPin(""); setError(null); }}>Back</Button>
          </form>
        )}

        {step === "pin" && <AddToHomeScreenButton appName="Office App" path="/office" variant="outline" className="w-full" />}

        {currentUserId && step === "pin" && (
          <button type="button" onClick={leaveOfficeApp} className="block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
            Not using the Office App? Sign out
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Change PIN ─── */
function ChangePinDialog({ open, onOpenChange, username }: { open: boolean; onOpenChange: (o: boolean) => void; username: string }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setCurrent(""); setNext(""); setConfirm(""); setError(null); } }, [open]);

  const save = async () => {
    const problem = newPinProblem(next, confirm);
    if (problem) { setError(problem); return; }
    setBusy(true);
    const res = await officePinCall({ action: "verify", username, pin: current, new_pin: next });
    setBusy(false);
    if (res.error || !res.ok) { setError(res.error ?? "Could not change your PIN."); return; }
    toast({ title: "PIN changed", description: "Use your new PIN next time you sign in." });
    onOpenChange(false);
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" inputMode="numeric" maxLength={6} value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ""))} className="h-11 text-center text-xl tracking-[0.4em]" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change your PIN</DialogTitle>
          <DialogDescription>Pick a 4-digit PIN only you know.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {field("cp-current", "Current PIN", current, setCurrent)}
          {field("cp-new", "New PIN", next, setNext)}
          {field("cp-confirm", "Type it again", confirm, setConfirm)}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy || current.length < 4 || next.length < 4 || confirm.length < 4}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Dashboard ─── */
function OfficeDashboard({ onLock }: { onLock: () => void }) {
  const { user, isAdmin, signOut } = useAuth();
  const { hidden, restrictedAllows } = usePortalSectionVisibility();
  const { canAccess: canAccessFinance } = useFinanceAccess();
  const { canAccessPl } = useCompanyPlAccess();
  const [profile, setProfile] = useState<{ full_name: string | null; user_types: string[] | null } | null>(null);
  const [changePin, setChangePin] = useState(false);
  const username = user?.email ? emailToUsername(user.email) : "";

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, user_types").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data ?? { full_name: null, user_types: [] });
      if ((data?.user_types ?? []).includes("office")) rememberCurrentSession(data?.full_name ?? null);
    });
  }, [user]);

  const tiles = visibleOfficeTiles({ isAdmin, canAccessFinance, canAccessPl, restrictedAllows }, hidden, isSuperAdminEmail(user?.email));
  const isOffice = (profile?.user_types ?? []).includes("office");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0];

  const signOutDevice = async () => {
    if (user) forgetPerson(user.id);
    setOfficeLocked(false);
    await signOut();
  };

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-lg" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground leading-tight">Office App</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.full_name ?? username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onLock} className="gap-2"><Lock className="h-4 w-4" />Lock</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More options"><MoreVertical className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setChangePin(true)}><KeyRound className="h-4 w-4 mr-2" />Change PIN</DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/portal"><LayoutDashboard className="h-4 w-4 mr-2" />Open full portal</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOutDevice} className="text-destructive"><LogOut className="h-4 w-4 mr-2" />Sign out of this device</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="text-sm text-muted-foreground">What do you need today?</p>
          <AddToHomeScreenButton appName="Office App" path="/office" className="mt-3" />
        </div>

        {profile && !isOffice && (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            The Office App is set up for office staff. Your account isn't marked as office, so some tools may not open for you.
          </p>
        )}

        <nav aria-label="Office tools" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => {
            const Icon = officeTileIcon(tile);
            return (
              <Link key={tile.path} to={tile.path}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{tile.label}</span>
                  <span className="block text-sm text-muted-foreground">{tile.description}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </nav>
        {tiles.length < OFFICE_APP_TILES.length && (
          <p className="text-xs text-muted-foreground">Some tools are hidden because Section Visibility doesn't include you.</p>
        )}
      </main>
      <ChangePinDialog open={changePin} onOpenChange={setChangePin} username={username} />
    </div>
  );
}

export default function OfficeAppPage() {
  useOfficeAppChrome();
  const { user, loading } = useAuth();
  const [locked, setLocked] = useState(isOfficeLocked());

  useEffect(() => {
    const sync = () => setLocked(isOfficeLocked());
    window.addEventListener("office-app-lock", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("office-app-lock", sync); window.removeEventListener("storage", sync); };
  }, []);

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user || locked) {
    return <UnlockScreen currentUserId={user?.id ?? null} onUnlocked={() => { setOfficeLocked(false); setLocked(false); }} />;
  }

  return <OfficeDashboard onLock={() => { setOfficeLocked(true); setLocked(true); }} />;
}
