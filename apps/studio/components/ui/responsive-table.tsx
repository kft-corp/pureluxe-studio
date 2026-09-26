import { cn } from "@/lib/utils/cn";

type ResponsiveTableBreakpoint = "md" | "lg";

type ResponsiveTableProps = {
  columns: string[];
  showActions?: boolean;
  children: React.ReactNode;
  /** Card layout below the desktop breakpoint. Ignored when `scrollOnNarrow` is true. */
  mobile?: React.ReactNode;
  /**
   * Always render the table and scroll horizontally when the viewport is narrow.
   * Use for dense directories (e.g. Clients) instead of a separate mobile card list.
   */
  scrollOnNarrow?: boolean;
  /** Minimum table width before horizontal scroll kicks in. */
  minWidthClassName?: string;
  /**
   * When to show the desktop table (cards below this).
   * Use `lg` for wide directories (e.g. Bookings). Default `md`.
   */
  breakpoint?: ResponsiveTableBreakpoint;
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
            {columns.map((column, index) => (
              <th
                key={column || `col-${index}`}
                className={cn(
                  "whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold tracking-wide text-ink uppercase first:px-6",
                  (column === "Actions" || column === "") && "px-6 text-right",
                )}
              >
                {column === "" ? (
                  <span className="sr-only">Actions</span>
                ) : (
                  column
                )}
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
  breakpoint = "md",
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

  const desktopClass =
    breakpoint === "lg" ? "hidden lg:block" : "hidden md:block";
  const mobileClass =
    breakpoint === "lg" ? "divide-y divide-border/70 lg:hidden" : "divide-y divide-border/70 md:hidden";

  return (
    <>
      <div className={desktopClass}>
        <TableShell
          columns={columns}
          showActions={showActions}
          minWidthClassName={minWidthClassName}
        >
          {children}
        </TableShell>
      </div>

      {mobile ? <div className={mobileClass}>{mobile}</div> : null}
    </>
  );
}

export function TableRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLTableRowElement>;
}) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150 hover:bg-brand-light",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
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
