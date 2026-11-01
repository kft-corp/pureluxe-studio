import { LuShieldOff } from "react-icons/lu";

type AccessDeniedProps = {
  feature?: string;
};

export function AccessDenied({ feature }: AccessDeniedProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface-raised px-4 py-10 text-center shadow-[0_8px_28px_rgba(22,26,31,0.05)] sm:px-12 sm:py-16">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface shadow-sm ring-4 ring-surface">
        <LuShieldOff
          className="h-6 w-6 text-ink-muted"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>

      <p className="mt-8 text-[11px] font-medium tracking-[0.22em] text-ink-subtle uppercase">
        Access restricted
      </p>

      <h2 className="studio-type-page mt-3 text-ink">
        You don&apos;t have access
      </h2>

      <p className="mx-auto mt-4 max-w-lg text-pretty text-sm leading-relaxed text-ink-muted">
        {feature ? (
          <>
            Your role doesn&apos;t include permission to view{" "}
            <span className="font-medium text-ink">{feature}</span>. Contact an
            admin if you need access.
          </>
        ) : (
          <>
            Your role doesn&apos;t include permission to view this area. Contact
            an admin if you need access.
          </>
        )}
      </p>
    </div>
  );
}
