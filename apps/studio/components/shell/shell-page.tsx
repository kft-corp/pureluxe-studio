type ShellPageProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function ShellPage({ title, description, children }: ShellPageProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink-muted sm:mt-2">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
