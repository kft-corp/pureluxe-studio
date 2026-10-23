"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils/cn";

type ChatMarkdownProps = {
  content: string;
  className?: string;
};

/** Status words the agent puts in backticks ("`Confirmed`"), coloured by meaning. */
const STATUS_TONES: Array<[RegExp, string]> = [
  [/confirm|booked|accepted|completed|approved/i, "bg-success-soft text-success-ink ring-success-line"],
  [/cancel/i, "bg-danger-soft text-danger-ink ring-danger-line"],
  [/pending|waiting|review/i, "bg-warning-soft text-warning-ink ring-warning-line"],
  [/quote|sent|booking/i, "bg-info-soft text-info-ink ring-info-line"],
];

function statusTone(label: string): string {
  return STATUS_TONES.find(([pattern]) => pattern.test(label))?.[1] ?? "bg-neutral-soft text-neutral-ink ring-neutral-line";
}

/**
 * Markdown for agent replies. Safe subset only (no raw HTML). A quote is the agent's
 * heads-up (a champagne callout) and inline code is a status pill.
 */
export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <div
      className={cn(
        "chat-md text-[15px] leading-[1.6] break-words text-ink",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-3 whitespace-pre-wrap">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-ink">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1.5 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1.5 pl-5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="marker:text-ink-muted">{children}</li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-ink underline decoration-accent underline-offset-2 hover:text-accent-ink-strong"
            >
              {children}
            </a>
          ),
          code: ({ className: codeClass, children }) => {
            const isBlock = Boolean(codeClass);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg bg-neutral-soft px-3 py-2 font-mono text-[12.5px] text-ink">
                  {children}
                </code>
              );
            }
            return (
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-px align-[1px] text-[12px] leading-5 font-medium ring-1 ring-inset",
                  statusTone(String(children)),
                )}
              >
                {children}
              </span>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2.5 overflow-x-auto rounded-lg bg-neutral-soft p-0">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-lg bg-accent-soft px-3 py-2 text-[14px] leading-relaxed text-ink ring-1 ring-inset ring-accent-line [&>p]:my-0">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <p className="mt-4 mb-1.5 font-serif text-[18px] leading-snug font-medium text-ink">
              {children}
            </p>
          ),
          h2: ({ children }) => (
            <p className="mt-4 mb-1.5 font-serif text-[18px] leading-snug font-medium text-ink">
              {children}
            </p>
          ),
          h3: ({ children }) => (
            <p className="mt-3.5 mb-1 font-serif text-[16px] leading-snug font-medium text-ink">
              {children}
            </p>
          ),
          hr: () => <hr className="my-3 border-border" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg ring-1 ring-border">
              <table className="w-full border-collapse text-left text-[13.5px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-surface-subtle px-3 py-2 text-[12px] font-semibold text-ink-muted">{children}</th>
          ),
          td: ({ children }) => <td className="border-t border-divider px-3 py-2 align-top text-ink">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
