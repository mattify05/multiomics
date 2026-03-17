import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dna, ArrowLeft, Loader2, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-sm text-center space-y-4">
          <Mail className="h-12 w-12 text-primary mx-auto" />
          <h2 className="font-display text-2xl font-semibold text-foreground">Check your email</h2>
          <p className="text-muted-foreground">
            If an account exists for <span className="text-foreground font-medium">{email}</span>, we've sent a password reset link.
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
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Dna className="h-4.5 w-4.5 text-primary" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">OmicsAI</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Reset password</h2>
          <p className="text-sm text-muted-foreground mt-1">We'll send a reset link to your email</p>
        </div>
        <form onSubmit={handleReset} className="space-y-5">
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send reset link
          </Button>
        </form>
      </div>
    </div>
  );
}
