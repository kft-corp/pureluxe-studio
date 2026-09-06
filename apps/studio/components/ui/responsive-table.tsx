import { cn } from "@/lib/utils/cn";

type ResponsiveTableProps = {
  columns: string[];
  showActions?: boolean;
  children: React.ReactNode;
  /** Card layout below `md`. Ignored when `scrollOnNarrow` is true. */
  mobile?: React.ReactNode;
  /**
   * Always render the table and scroll horizontally when the viewport is narrow.
   * Use for dense directories (e.g. Clients) instead of a separate mobile card list.
   */
  scrollOnNarrow?: boolean;
  /** Minimum table width before horizontal scroll kicks in. */
  minWidthClassName?: string;
};

function TableShell({
  columns,
  showActions,
  children,
  minWidthClassName,
}: {
  columns: string[];
  showActions?: boolean;
  children: React.ReactNode;
  minWidthClassName: string;
}) {
  return (
    <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
      <table className={cn("w-full text-left text-sm", minWidthClassName)}>
        <thead>
          <tr className="border-b border-border/80 bg-surface/50">
            {columns.map((column) => (
              <th
                key={column}
                className={cn(
                  "whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold tracking-wide text-ink uppercase first:px-6",
                  column === "Actions" && "px-6 text-right",
                )}
              >
                {column}
              </th>
            ))}
            {showActions && !columns.includes("Actions") ? (
              <th className="whitespace-nowrap px-6 py-3.5 text-right text-[11px] font-semibold tracking-wide text-ink uppercase">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">{children}</tbody>
      </table>
    </div>
  );
}

export function ResponsiveTable({
  columns,
  showActions,
  children,
  mobile,
  scrollOnNarrow = false,
  minWidthClassName = "min-w-[40rem]",
}: ResponsiveTableProps) {
  if (scrollOnNarrow) {
    return (
      <TableShell
        columns={columns}
        showActions={showActions}
        minWidthClassName={minWidthClassName}
      >
        {children}
      </TableShell>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <TableShell
          columns={columns}
          showActions={showActions}
          minWidthClassName={minWidthClassName}
        >
          {children}
        </TableShell>
      </div>

      {mobile ? (
        <div className="divide-y divide-border/70 md:hidden">{mobile}</div>
      ) : null}
    </>
  );
}

export function TableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150 hover:bg-brand-light",
        className,
      )}
    >
      {children}
    </tr>
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

export function MobileCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("px-4 py-4 sm:px-5", className)}>{children}</article>
  );
}
