"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { LuChevronsUpDown, LuX } from "react-icons/lu";
import {
  getCountryName,
  isValidCountryCode,
  listCountryOptions,
  type CountryOption,
} from "@pureluxe/shared";

import { modalFieldClassName } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

const COUNTRY_OPTIONS = listCountryOptions();

type CountryComboboxProps = {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function filterCountries(query: string): CountryOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRY_OPTIONS;
  return COUNTRY_OPTIONS.filter(
    (option) =>
      option.name.toLowerCase().includes(q) ||
      option.code.toLowerCase().includes(q),
  );
}

/**
 * Searchable ISO country picker — stores alpha-2 codes (US, IN, …).
 * List is portaled so it isn’t clipped by modal / section overflow.
 */
export function CountryCombobox({
  id,
  value,
  onChange,
  placeholder = "Search countries…",
  disabled,
  className,
}: Readonly<CountryComboboxProps>) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const [mounted, setMounted] = useState(false);

  const selectedName = isValidCountryCode(value)
    ? (getCountryName(value) ?? value)
    : "";

  const [query, setQuery] = useState(selectedName);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery(selectedName);
    }
  }, [selectedName, open]);

  const matches = useMemo(() => filterCountries(query).slice(0, 12), [query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuStyle(null);
      return;
    }

    function updatePosition() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 240 && rect.top > spaceBelow;
      const maxHeight = Math.min(224, openUp ? rect.top - 12 : spaceBelow - 12);

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, maxHeight),
        zIndex: 80,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, matches.length]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const list = document.getElementById(listId);
      if (list?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, listId]);

  function selectCountry(option: CountryOption) {
    onChange(option.code);
    setQuery(option.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clearSelection() {
    onChange("");
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) =>
        matches.length === 0 ? 0 : Math.min(index + 1, matches.length - 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && matches[highlight]) {
      event.preventDefault();
      selectCountry(matches[highlight]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery(selectedName);
    }
  }

  const list = open && menuStyle && mounted ? (
    <ul
      id={listId}
      role="listbox"
      style={menuStyle}
      className="overflow-auto rounded-xl border border-border bg-surface-raised py-1 shadow-lg"
    >
      {matches.length === 0 ? (
        <li className="px-3 py-2.5 text-sm text-ink-muted">
          No countries match “{query.trim()}”
        </li>
      ) : (
        matches.map((option, index) => {
          const active = index === highlight;
          const selected = option.code === value;
          return (
            <li key={option.code} role="presentation">
              <button
                type="button"
                id={`${listId}-option-${option.code}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => selectCountry(option)}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition",
                  active
                    ? "bg-brand-dark/8 text-ink"
                    : "text-ink hover:bg-surface-hover",
                )}
              >
                <span className="font-medium">{option.name}</span>
                <span className="text-xs tabular-nums text-ink-muted">
                  {option.code}
                </span>
              </button>
            </li>
          );
        })
      )}
    </ul>
  ) : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[highlight]
              ? `${listId}-option-${matches[highlight].code}`
              : undefined
          }
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(modalFieldClassName, "pr-16")}
        />
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
          {value || query ? (
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-ink"
              aria-label="Clear nationality"
              tabIndex={-1}
            >
              <LuX className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen((wasOpen) => !wasOpen);
              inputRef.current?.focus();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-50"
            aria-label="Toggle country list"
            tabIndex={-1}
          >
            <LuChevronsUpDown className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {mounted && list ? createPortal(list, document.body) : null}
    </div>
  );
}
