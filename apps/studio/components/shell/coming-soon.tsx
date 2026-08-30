import { LuSparkles } from "react-icons/lu";

type ComingSoonProps = {
  /** Page title — used for a contextual message, e.g. "Bookings". */
  feature?: string;
  /** When true, shows that edit access is included when the feature ships. */
  canWrite?: boolean;
};

export function ComingSoon({ feature, canWrite = false }: ComingSoonProps) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-sm",
        "bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,var(--surface-hover),var(--surface-raised)_55%)]",
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 75%)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-border to-transparent sm:inset-x-8"
      />

      <div className="relative px-4 py-10 text-center sm:px-12 sm:py-20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-raised shadow-sm ring-4 ring-surface">
          <LuSparkles
            className="h-6 w-6 text-ink-muted"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>

        <p className="mt-6 text-[11px] font-medium tracking-[0.22em] text-ink-subtle uppercase sm:mt-8">
          In development
        </p>

        <h2 className="mt-3 font-serif text-2xl font-normal tracking-tight text-ink sm:text-4xl">
          Coming soon
        </h2>

        <p className="mx-auto mt-4 max-w-lg text-pretty text-sm leading-relaxed text-ink-muted">
          {feature ? (
            <>
              <span className="font-medium text-ink">{feature}</span> is on the
              roadmap. We&apos;re building a focused workspace for your
              team&apos;s day-to-day operations.
              {canWrite ? (
                <>
                  {" "}
                  Your role includes edit access when this module launches.
                </>
              ) : null}
            </>
          ) : (
            <>
              This workspace is on the roadmap. We&apos;re building focused
              tools for your team&apos;s day-to-day operations.
            </>
          )}
        </p>

        <div
          aria-hidden
          className="mx-auto mt-10 flex w-full max-w-xs items-center gap-3"
        >
          <span className="h-px flex-1 bg-linear-to-r from-transparent to-border" />
          <span className="flex gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle/50" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle/30" />
          </span>
          <span className="h-px flex-1 bg-linear-to-l from-transparent to-border" />
        </div>
      </div>
    </div>
  );
}
