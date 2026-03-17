import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dna, UserPlus, Loader2, CheckCircle } from "lucide-react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-sm text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-success mx-auto" />
          <h2 className="font-display text-2xl font-semibold text-foreground">Check your email</h2>
          <p className="text-muted-foreground">
            We've sent a verification link to <span className="text-foreground font-medium">{email}</span>.
            Please verify your email to activate your account.
          </p>
          <Link to="/login">
            <Button variant="outline" className="mt-4">Back to login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Dna className="h-4.5 w-4.5 text-primary" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">OmicsAI</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Create account</h2>
          <p className="text-sm text-muted-foreground mt-1">Join OmicsAI to start your research</p>
        </div>
        <form onSubmit={handleSignup} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              placeholder="Dr. Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Institutional email</Label>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="bg-secondary border-border"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Create account
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
