export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#0b0b0c] px-6 text-[#f4f1ea]">
      <main className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <p className="text-xs tracking-[0.28em] text-[#a39e93] uppercase">
          PureLuxe
        </p>
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
          Studio
        </h1>
        <p className="max-w-sm text-sm leading-6 text-[#a39e93]">
          Internal team only. Sign-in and core modules come next.
        </p>
      </main>
    </div>
  );
}
