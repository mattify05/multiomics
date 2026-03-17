import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dna, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="bg-gradient-glow pointer-events-none absolute inset-0" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Dna className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">OmicsAI</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-foreground leading-tight mb-4">
            Multi-omics Intelligence<br />
            <span className="text-gradient-primary">for Precision Medicine</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Integrate, analyze, and interpret genomic data with explainable AI — from raw reads to clinical insights.
          </p>
        </div>
        <p className="relative z-10 text-sm text-muted-foreground">
          HIPAA-compliant · SOC 2 · End-to-end encryption
        </p>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Dna className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">OmicsAI</span>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Enter your credentials to continue</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="researcher@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-secondary border-border"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Sign in
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
