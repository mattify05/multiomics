import { cn } from "@/lib/utils";

type Status = "running" | "completed" | "failed" | "queued" | "pending" | "validated" | "warning" | "draft";

const statusStyles: Record<Status, string> = {
  running: "bg-info/15 text-info border-info/30",
  completed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  queued: "bg-muted text-muted-foreground border-border",
  pending: "bg-muted text-muted-foreground border-border",
  validated: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  draft: "bg-secondary text-secondary-foreground border-border",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
        statusStyles[status]
      )}
    >
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "running" && "bg-info animate-pulse",
        status === "completed" && "bg-success",
        status === "failed" && "bg-destructive",
        status === "queued" && "bg-muted-foreground",
        status === "pending" && "bg-muted-foreground",
        status === "validated" && "bg-success",
        status === "warning" && "bg-warning",
        status === "draft" && "bg-secondary-foreground",
      )} />
      {status}
    </span>
  );
}
