import { useState } from "react";

export default function PlatformSettings() {
  const [retention, setRetention] = useState("180 days");
  const [supportEmail, setSupportEmail] = useState("support@omicsai.app");
  const [bucketLimit, setBucketLimit] = useState("10 GB per file");

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Platform Settings</h2>
        <p className="text-sm text-muted-foreground">
          Read-only defaults for storage, retention, and support channels. Billing and cluster controls can be layered in next.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Storage</p>
          <p className="text-sm font-medium text-foreground">{bucketLimit}</p>
          <p className="text-xs text-muted-foreground">`omics-data` bucket upload limit.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Retention</p>
          <p className="text-sm font-medium text-foreground">{retention}</p>
          <p className="text-xs text-muted-foreground">Default retention policy copy shown to workspace users.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Support</p>
          <p className="text-sm font-medium text-foreground">{supportEmail}</p>
          <p className="text-xs text-muted-foreground">Primary support mailbox.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">Admin roadmap</p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Workspace-level storage quotas and org overrides</li>
          <li>Billing hooks for cloud compute providers</li>
          <li>Data retention exceptions and legal hold workflow</li>
        </ul>
      </div>
    </div>
  );
}
