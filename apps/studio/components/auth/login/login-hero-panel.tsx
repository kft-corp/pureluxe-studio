import Image from "next/image";

import loginHeroImage from "@/assets/login-hero.jpg";

const FEATURES = [
  { label: "Queue", icon: QueueIcon },
  { label: "Trip Builder", icon: MapIcon },
  { label: "Bookings & Clients", icon: UsersIcon },
] as const;

export function LoginHeroPanel() {
  return (
    <section
      aria-label="PureLuxe Studio overview"
      className="relative hidden h-full min-h-0 overflow-hidden lg:block lg:w-3/5"
    >
      <Image
        src={loginHeroImage}
        alt="PureLuxe Studio overview"
        fill
        priority
        aria-hidden
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 60vw"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/75 via-black/45 to-black/20"
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col items-center justify-center px-8 py-6 text-center text-white lg:px-12 [@media(max-height:800px)]:py-4">
        <div className="flex w-full max-w-xl flex-col items-center gap-5 lg:gap-6 [@media(max-height:800px)]:gap-4">
          <p className="text-[11px] font-medium tracking-[0.28em] text-white/75 uppercase sm:text-[13px] [@media(max-height:720px)]:hidden">
            Internal operations
          </p>

          <h2 className="font-serif text-2xl leading-tight font-normal tracking-tight sm:text-3xl lg:text-4xl lg:leading-[1.15] xl:text-[2.75rem]">
            Operate every trip in one place.
          </h2>

          <p className="max-w-md text-sm leading-relaxed text-white/85 sm:text-base lg:text-[15px] xl:text-lg">
            Queue, Trip Builder, bookings, and clients — one shared workspace.
          </p>

          <hr
            aria-hidden="true"
            className="w-full max-w-xs border-0 border-t border-white/25 [@media(max-height:720px)]:hidden"
          />

          <ul
            aria-label="Studio product areas"
            className="flex flex-row flex-wrap items-start justify-center gap-6 lg:gap-8 [@media(max-height:800px)]:gap-5"
          >
            {FEATURES.map(({ label, icon: Icon }) => (
              <li key={label} className="flex w-[5.5rem] flex-col items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10"
                >
                  <Icon />
                </span>
                <span className="text-center text-[11px] leading-snug text-white/90 sm:text-xs">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function QueueIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-5 w-5"
    >
      <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-5 w-5"
    >
      <path
        d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"
        strokeLinejoin="round"
      />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-5 w-5"
    >
      <path
        d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"
        strokeLinecap="round"
      />
      <circle cx="9" cy="8" r="3" />
      <path
        d="M22 19v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
