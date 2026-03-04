import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { usernameToEmail } from "@/lib/auth-utils";

const signInSchema = z.object({
  username: z.string().trim().min(1, { message: "Username is required" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signUpSchema = z.object({
  username: z.string().trim().min(1, { message: "Username is required" })
    .regex(/^[a-zA-Z0-9._-]+$/, { message: "Username can only contain letters, numbers, dots, underscores, and hyphens" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  fullName: z.string().trim().min(1, { message: "Full name is required" }),
});

const AuthPage = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [signInUsername, setSignInUsername] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/portal");
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = signInSchema.parse({ username: signInUsername, password: signInPassword });
      setIsLoading(true);
      const email = usernameToEmail(validated.username);
      const { error } = await signIn(email, validated.password);
      if (error) {
        toast({
          title: "Login failed",
          description: error.message.includes("Invalid login credentials")
            ? "Invalid username or password. Please try again."
            : error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: "Signed in successfully!" });
        navigate("/portal");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = signUpSchema.parse({ username: signUpUsername, password: signUpPassword, fullName });
      setIsLoading(true);
      const email = usernameToEmail(validated.username);
      const { error } = await signUp(email, validated.password, validated.fullName);
      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message.includes("already registered")
            ? "This username is already taken. Please choose another."
            : error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: "Account created successfully! You can now sign in." });
        setSignInUsername(validated.username);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* WasteOne brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold">W1</span>
          </div>
          <span className="font-bold text-2xl text-foreground tracking-tight">WasteOne</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to WasteOne</CardTitle>
            <CardDescription>Access the unified waste management platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-username">Username</Label>
                    <Input id="signin-username" type="text" placeholder="Enter your username" value={signInUsername} onChange={(e) => setSignInUsername(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input id="signin-password" type="password" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <Input id="signup-username" type="text" placeholder="Choose a username" value={signUpUsername} onChange={(e) => setSignUpUsername(e.target.value)} required />
                    <p className="text-xs text-muted-foreground">Letters, numbers, dots, underscores, and hyphens only</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
