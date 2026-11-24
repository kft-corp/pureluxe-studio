"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { readDirectoryReturn } from "@/lib/directory";

type DirectoryBackLinkProps = {
  /** Clean list path, e.g. `/clients`. */
  href: string;
  className?: string;
  children: ReactNode;
};

/** Returns to the last filtered directory URL when one was remembered this session. */
export function DirectoryBackLink({
  href,
  className,
  children,
}: DirectoryBackLinkProps) {
  const [resolvedHref, setResolvedHref] = useState(href);

  useEffect(() => {
    setResolvedHref(readDirectoryReturn(href, href));
  }, [href]);

  return (
    <Link href={resolvedHref} className={className}>
      {children}
    </Link>
  );
}
