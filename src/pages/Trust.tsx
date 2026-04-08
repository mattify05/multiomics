import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

export default function Trust() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-display text-xl font-semibold">Security &amp; compliance</h1>
      </div>
      <div className="prose prose-sm text-muted-foreground space-y-4">
        <p>
          OmicsAI is built with <strong className="text-foreground">Supabase Auth</strong>,{" "}
          <strong className="text-foreground">Row Level Security</strong> on Postgres, and{" "}
          <strong className="text-foreground">object-level policies</strong> on Storage. Audit triggers record many data changes to{" "}
          <code className="text-xs">audit_log</code> for administrators.
        </p>
        <p>
          <strong className="text-foreground">Important:</strong> This repository is a product scaffold. It is{" "}
          <strong className="text-foreground">not</strong> automatically HIPAA-compliant or SOC 2 certified. Achieving those
          attestation requires organizational controls: Business Associate Agreements, formal risk analysis, logging retention, PHI
          handling procedures, and often a BAA-covered cloud configuration.
        </p>
        <p>
          Before advertising compliance to customers, complete your assurance program and update this page with accurate scope (regions,
          subprocessors, encryption, access reviews).
        </p>
        <Link to="/login" className="text-primary text-sm font-medium">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
