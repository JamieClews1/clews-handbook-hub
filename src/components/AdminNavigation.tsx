import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, Settings, Home, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export const AdminNavigation = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
  };

  return (
    <nav className="bg-card border-b border-border">
      <div className="container mx-auto px-4 py-2 flex gap-2 items-center justify-between">
        <div className="flex gap-2">
          <Link to="/">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              View Handbook
            </Button>
          </Link>
          <Link to="/admin">
            <Button
              variant={location.pathname === "/admin" ? "default" : "ghost"}
              size="sm"
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Manage Content
            </Button>
          </Link>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </nav>
  );
};
