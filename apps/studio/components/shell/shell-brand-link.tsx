import Link from "next/link";

import { pageRoutes } from "@/lib/routes";

type ShellBrandLinkProps = {
  theme: "sidebar" | "light";
  compact?: boolean;
  onNavigate?: () => void;
};

export function ShellBrandLink({
  theme,
  compact = false,
  onNavigate,
}: ShellBrandLinkProps) {
  const isSidebar = theme === "sidebar";

  if (compact) {
    return (
      <Link
        href={pageRoutes.home}
        onClick={onNavigate}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border-muted bg-white/5 font-serif text-sm font-medium tracking-tight text-on-dark transition hover:border-on-dark-subtle hover:bg-white/10 hover:text-white"
        title="PureLuxe Studio"
      >
        PL
      </Link>
    );
  }

  return (
    <Link
      href={pageRoutes.home}
      onClick={onNavigate}
      className={[
        "group min-w-0 py-0.5 transition-opacity hover:opacity-90",
        isSidebar ? "text-on-dark" : "text-ink",
      ].join(" ")}
      title="PureLuxe Studio"
    >
      <span
        className={[
          "block font-serif text-[1.375rem] font-normal leading-none tracking-tight",
          isSidebar ? "text-on-dark group-hover:text-white" : "text-ink",
        ].join(" ")}
      >
        PureLuxe
      </span>
      <span
        className={[
          "mt-1.5 block font-sans text-[9px] font-medium uppercase tracking-[0.34em]",
          isSidebar ? "text-on-dark-subtle" : "text-ink-subtle",
        ].join(" ")}
      >
        Studio
      </span>
    </Link>
  );
}
