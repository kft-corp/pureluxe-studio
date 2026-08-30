import { LuShieldOff } from "react-icons/lu";

type AccessDeniedProps = {
  feature?: string;
};

export function AccessDenied({ feature }: AccessDeniedProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-raised px-4 py-10 text-center shadow-sm sm:px-12 sm:py-16">
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

      <h2 className="mt-3 font-serif text-2xl font-normal tracking-tight text-ink sm:text-4xl">
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
