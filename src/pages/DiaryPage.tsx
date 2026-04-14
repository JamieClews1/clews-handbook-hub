import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DiaryWeekView } from "@/components/diary/DiaryWeekView";
import clewsLogo from "@/assets/clews-logo.png";

const DiaryPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      <header className="sticky top-0 z-50 bg-white dark:bg-background border-b border-border/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/one-portal">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">One Portal</span>
              </Button>
            </Link>
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-8 max-w-[1600px]">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Diary</h1>
          <p className="text-sm text-muted-foreground/60 mt-1">Your weekly outlook</p>
        </div>
        <DiaryWeekView />
      </main>
    </div>
  );
};

export default DiaryPage;
