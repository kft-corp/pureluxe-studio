import { cn } from "@/lib/utils/cn";

type ResponsiveTableProps = {
  columns: string[];
  showActions?: boolean;
  children: React.ReactNode;
  mobile: React.ReactNode;
};

export function ResponsiveTable({
  columns,
  showActions,
  children,
  mobile,
}: ResponsiveTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-surface/50">
              {columns.map((column) => (
                <th
                  key={column}
                  className={cn(
                    "px-4 py-3.5 text-xs font-medium text-ink-muted first:px-6",
                    column === "Actions" && "px-6 text-right",
                  )}
                >
                  {column}
                </th>
              ))}
              {showActions && !columns.includes("Actions") ? (
                <th className="px-6 py-3.5 text-right text-xs font-medium text-ink-muted">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">{children}</tbody>
        </table>
      </div>

      <div className="divide-y divide-border/70 md:hidden">{mobile}</div>
    </>
  );
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="transition-colors hover:bg-surface-hover/50">{children}</tr>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-4 first:px-6", className)}>{children}</td>
  );
}

export function MobileCard({ children }: { children: React.ReactNode }) {
  return <article className="px-5 py-4">{children}</article>;
}
