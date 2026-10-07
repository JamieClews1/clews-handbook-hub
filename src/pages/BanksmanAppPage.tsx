import { useEffect, useState } from "react";
import { driverAction } from "@/lib/driver-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  AlertTriangle,
  HardHat,
  Loader2,
  LogOut,
  RefreshCw,
  Scale,
  Truck,
  Weight,
  Package,
  ChevronRight,
  CheckCircle2,
  Search,
} from "lucide-react";
import BanksmanWorkflow from "@/components/banksman/BanksmanWorkflow";

/* ─── Types ─── */
interface BanksmanUser {
  id: string;
  name: string;
}


const SESSION_KEY = "banksman_session";

/* ─── PIN Login ─── */
const BanksmanLogin = ({ onLogin }: { onLogin: (u: BanksmanUser) => void }) => {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !pin) {
      setError("Enter your username and PIN");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { staff } = await driverAction("yard_login", {
        username: username.trim(),
        pin,
      });
      if (!staff) {
        setError("Invalid username or PIN");
        setLoading(false);
        return;
      }
      const user: BanksmanUser = { id: staff.id, name: staff.staff_name };
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: staff.id, ts: Date.now() }));
      onLogin(user);
    } catch (e) {
      setError((e as Error).message || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-7">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/20 mb-2">
            <HardHat className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Banksman</h1>
          <p className="text-zinc-400 text-lg">Load photos & contamination</p>
        </div>

        <div className="space-y-3">
          <label className="text-zinc-300 text-sm font-medium">Username</label>
          <Input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            className="h-14 text-xl text-center bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>


        <div className="space-y-3">
          <label className="text-zinc-300 text-sm font-medium">PIN</label>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold",
                  pin.length > i
                    ? "bg-amber-500/20 border-amber-500 text-amber-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-600",
                )}
              >
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
            <Button
              key={key || "empty"}
              variant="ghost"
              disabled={key === ""}
              onClick={() => {
                if (key === "⌫") setPin((p) => p.slice(0, -1));
                else if (key !== "" && pin.length < 6) setPin((p) => p + key);
              }}
              className={cn(
                "h-16 text-2xl font-semibold rounded-xl",
                key === ""
                  ? "invisible"
                  : key === "⌫"
                    ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    : "text-white hover:bg-zinc-800 bg-zinc-800/50",
              )}
            >
              {key}
            </Button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <Button
          onClick={handleLogin}
          disabled={loading || !username.trim() || !pin}
          className="w-full h-16 text-xl font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In"}
        </Button>
      </div>
    </div>
  );
};


/* ─── Root ─── */
const BanksmanAppPage = () => {
  const [user, setUser] = useState<BanksmanUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    document.title = "Banksman | WasteOne";
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) link.setAttribute("href", "/manifest-banksman.webmanifest");
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      setRestoring(false);
      return;
    }
    try {
      const { id } = JSON.parse(raw);
      if (!id) {
        setRestoring(false);
        return;
      }
      driverAction("yard_restore", { id })
        .then(({ staff }) => {
          if (staff) setUser({ id: staff.id, name: staff.staff_name });
          else localStorage.removeItem(SESSION_KEY);
        })
        .catch(() => localStorage.removeItem(SESSION_KEY))
        .finally(() => setRestoring(false));
    } catch {
      localStorage.removeItem(SESSION_KEY);
      setRestoring(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  if (restoring) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user) return <BanksmanLogin onLogin={setUser} />;
  return <BanksmanWorkflow user={user} onLogout={handleLogout} />;
};

export default BanksmanAppPage;
