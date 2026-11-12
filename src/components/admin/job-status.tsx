const labels: Record<string, string> = {
  QUEUED: "queued",
  AWAITING_APPROVAL: "awaiting cost approval",
  RUNNING: "running",
  RENDERING: "rendering",
  SUCCEEDED: "done",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

const styles: Record<string, string> = {
  SUCCEEDED: "border-lime bg-lime text-lime-foreground",
  FAILED: "border-destructive text-destructive",
  RUNNING: "border-primary text-primary",
  RENDERING: "border-primary text-primary",
  AWAITING_APPROVAL: "border-dashed border-pink",
};

export function JobStatus({ status }: { status: string | null }) {
  if (!status) return <span className="font-mono text-xs text-muted-foreground">not started</span>;
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-xs ${styles[status] ?? ""}`}>
      {labels[status] ?? status.toLowerCase()}
    </span>
  );
}
