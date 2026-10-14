"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

export type ToolbarMenuItem = {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Second line under the label. */
  hint?: string;
  /** Shown greyed out; the hint should say why. */
  disabled?: boolean;
  /** Rule above this item. */
  divider?: boolean;
  icon?: ReactNode;
};

type MenuPosition = { top: number; left: number; maxHeight: number };

const GAP = 4;
const EDGE = 8;

/**
 * Small dropdown for secondary page actions (detail hero “More”, Edit menus).
 * Drawn in a portal so cards with overflow-hidden do not clip it.
 */
export function ToolbarMenu({
  trigger,
  items,
  heading,
  menuClassName = "min-w-[10rem]",
}: {
  trigger: (args: { open: boolean; toggle: () => void }) => ReactNode;
  items: ToolbarMenuItem[];
  heading?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const anchor = rootRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const width = menu.offsetWidth;
    const height = menu.scrollHeight;
    const below = window.innerHeight - anchor.bottom - GAP - EDGE;
    const above = anchor.top - GAP - EDGE;
    const openUp = height > below && above > below;
    const room = openUp ? above : below;
    const shown = Math.min(height, room);
    const left = Math.min(
      Math.max(EDGE, anchor.right - width),
      window.innerWidth - width - EDGE,
    );
    setPosition({
      top: openUp ? anchor.top - GAP - shown : anchor.bottom + GAP,
      left: Math.max(EDGE, left),
      maxHeight: room,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                maxHeight: position?.maxHeight,
                visibility: position ? "visible" : "hidden",
              }}
              className={cn(
                "z-50 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg",
                menuClassName,
              )}
            >
              {heading ? (
                <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                  {heading}
                </p>
              ) : null}
              {items.map((item) => (
                <div key={item.key}>
                  {item.divider ? <div className="my-1 border-t border-border/80" /> : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm",
                      item.disabled ? "cursor-not-allowed opacity-50" : "hover:bg-surface-hover",
                      item.danger ? "text-red-700" : "text-ink",
                    )}
                    onClick={() => {
                      if (item.disabled) return;
                      setOpen(false);
                      item.onClick();
                    }}
                  >
                    {item.icon ? <span className="mt-0.5 shrink-0">{item.icon}</span> : null}
                    <span className="min-w-0">
                      <span className={cn("block", item.hint && "font-medium")}>{item.label}</span>
                      {item.hint ? (
                        <span
                          className={cn(
                            "mt-0.5 block text-xs font-normal",
                            item.danger ? "text-red-700/80" : "text-ink-muted",
                          )}
                        >
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
