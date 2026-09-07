"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LuArrowLeft, LuLock, LuTriangleAlert } from "react-icons/lu";
import { createClientSchema } from "@pureluxe/shared";

import {
  ContentSection,
  CountryCombobox,
  PageStack,
  PhoneInput,
  studioButtonClass,
  studioChipClass,
} from "@/components/ui";
import { modalFieldClassName } from "@/components/ui/modal";
import {
  createClient,
  searchClients,
  type ClientSearchHit,
} from "@/lib/api/clients";
import { PREFERRED_CONTACT_OPTIONS, type ClientTierOption } from "@/lib/clients";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

type ContactMethod = "email" | "phone" | "whatsapp" | "";

type RegisterField =
  | "display_name"
  | "legal_name"
  | "email"
  | "phone"
  | "whatsapp"
  | "preferred_contact_method"
  | "tier_id"
  | "nationality"
  | "city_of_residence"
  | "internal_notes"
  | "guest_notes";

type FieldErrors = Partial<Record<RegisterField, string>>;

function fieldErrorsFromIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): FieldErrors {
  const next: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key !== "string" || key in next) continue;
    next[key as RegisterField] = issue.message;
  }
  return next;
}

function RequiredMark() {
  return (
    <span className="ml-0.5 font-semibold text-red-600" aria-hidden>
      *
    </span>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  required,
  error,
  children,
}: Readonly<{
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}>) {
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required ? <RequiredMark /> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function fieldControlClass(invalid: boolean) {
  return cn(
    modalFieldClassName,
    invalid && "border-red-400/70 ring-2 ring-red-400/40",
  );
}

function FormSection({
  step,
  title,
  description,
  children,
}: Readonly<{
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}>) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-dark text-xs font-semibold text-on-dark"
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4 sm:pl-10">{children}</div>
    </section>
  );
}

function SimilarClientsPanel({
  checking,
  matches,
  acknowledged,
  onAcknowledge,
}: Readonly<{
  checking: boolean;
  matches: ClientSearchHit[];
  acknowledged: boolean;
  onAcknowledge: () => void;
}>) {
  if (checking && matches.length === 0) {
    return (
      <div className="rounded-xl border border-border/80 bg-surface px-4 py-3">
        <p className="text-sm text-ink-muted">Checking for existing clients…</p>
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <div
      className="space-y-3 rounded-xl border border-amber-700/20 bg-amber-50/90 px-4 py-3.5"
    >
      <div className="flex gap-2.5">
        <LuTriangleAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-800"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Possible existing clients
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            Open a match if this is the same person. Otherwise confirm to create
            a new record.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {matches.map((hit) => (
          <li key={hit.id}>
            <Link
              href={pageRoutes.client(hit.id)}
              className="flex flex-col gap-0.5 rounded-lg border border-border/70 bg-surface-raised px-3.5 py-2.5 text-sm transition hover:border-brand-dark/25 hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <span className="min-w-0 truncate font-medium text-ink">
                {hit.display_name}
              </span>
              <span className="min-w-0 truncate text-xs text-ink-muted">
                {[hit.email, hit.phone].filter(Boolean).join(" · ") ||
                  hit.tier.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {acknowledged ? (
        <p className="text-xs font-medium text-ink-muted">
          Confirmed — you can create a new client.
        </p>
      ) : (
        <button
          type="button"
          onClick={onAcknowledge}
          className={studioButtonClass("secondary", "sm")}
        >
          None of these — create new
        </button>
      )}
    </div>
  );
}

function submitLabel(args: {
  loading: boolean;
  needsDuplicateAck: boolean;
  hasPossibleDuplicates: boolean;
}): string {
  if (args.loading) return "Creating…";
  if (args.needsDuplicateAck) return "Review matches first";
  if (args.hasPossibleDuplicates) return "Create new client";
  return "Create client";
}

/** Lean register form — essentials to open a usable client record. */
export function ClientRegisterForm({
  tiers,
  defaultTierId,
}: Readonly<{
  tiers: ClientTierOption[];
  defaultTierId: string | null;
}>) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [preferredContact, setPreferredContact] = useState<ContactMethod>("");
  const [tierId, setTierId] = useState(defaultTierId ?? "");
  const [nationality, setNationality] = useState("");
  const [city, setCity] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [similarClients, setSimilarClients] = useState<ClientSearchHit[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  /** Search fingerprint the advisor acknowledged as “not a duplicate”. */
  const [acknowledgedSearchKey, setAcknowledgedSearchKey] = useState<
    string | null
  >(null);

  const trimmedName = displayName.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();
  const searchKey = `${trimmedName}|${trimmedEmail}|${trimmedPhone}`;
  const searchQuery = trimmedName || trimmedEmail || trimmedPhone;
  const queryReady = searchQuery.length >= 2;
  const hasContact = Boolean(trimmedEmail || trimmedPhone);
  const matches = queryReady ? similarClients : [];
  const hasPossibleDuplicates = matches.length > 0;
  const acknowledgedDuplicates = acknowledgedSearchKey === searchKey;
  const needsDuplicateAck = hasPossibleDuplicates && !acknowledgedDuplicates;
  const canSubmit =
    trimmedName.length > 0 && hasContact && !loading && !needsDuplicateAck;
  const showSimilarPanel =
    queryReady && (checkingSimilar || hasPossibleDuplicates);
  const showWhatsapp =
    preferredContact === "whatsapp" ||
    Boolean(whatsapp.trim()) ||
    Boolean(trimmedPhone);

  let contactHint: "missing" | "hint" | null = "hint";
  if (fieldErrors.email || fieldErrors.phone) {
    contactHint = null;
  } else if (!hasContact && trimmedName.length > 0) {
    contactHint = "missing";
  }

  function clearFieldError(...fields: RegisterField[]) {
    setFieldErrors((current) => {
      let changed = false;
      const next = { ...current };
      for (const field of fields) {
        if (field in next) {
          delete next[field];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  useEffect(() => {
    if (!queryReady) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCheckingSimilar(true);
      void searchClients({ q: searchQuery, limit: 5 })
        .then((response) => {
          if (!cancelled) setSimilarClients(response.data.clients);
        })
        .catch(() => {
          if (!cancelled) setSimilarClients([]);
        })
        .finally(() => {
          if (!cancelled) setCheckingSimilar(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [queryReady, searchQuery]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const preferred =
      preferredContact === "email" ||
      preferredContact === "phone" ||
      preferredContact === "whatsapp"
        ? preferredContact
        : null;

    const payload = {
      display_name: trimmedName,
      legal_name: legalName.trim() || null,
      email: trimmedEmail || null,
      phone: trimmedPhone || null,
      whatsapp: whatsapp.trim() || null,
      preferred_contact_method: preferred,
      ...(tierId ? { tier_id: tierId } : {}),
      nationality: nationality.trim() || null,
      city_of_residence: city.trim() || null,
      internal_notes: internalNotes.trim() || null,
      guest_notes: guestNotes.trim() || null,
    };

    const parsed = createClientSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromIssues(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const response = await createClient(parsed.data);

      showOptionalSuccessToast(response.message);
      router.push(pageRoutes.client(response.data.client.id));
      router.refresh();
    } catch (error) {
      showApiError(error);
      setLoading(false);
    }
  }

  return (
    <PageStack>
      <div>
        <Link
          href={pageRoutes.clients}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden />
          All clients
        </Link>
      </div>

      <ContentSection
        title="Register client"
        description="Capture who they are and how to reach them. You can add preferences, health, and documents on their profile next."
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-2xl space-y-8 px-5 py-6 sm:px-6 sm:py-7"
          noValidate
        >
          <p className="text-xs text-ink-muted">
            <span className="font-semibold text-red-600">*</span> Required fields
          </p>

          <FormSection
            step={1}
            title="Identity"
            description="How the team addresses this guest."
          >
            <Field
              label="Preferred name"
              htmlFor="register-display-name"
              required
              error={fieldErrors.display_name}
            >
              <input
                id="register-display-name"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  clearFieldError("display_name");
                }}
                className={fieldControlClass(Boolean(fieldErrors.display_name))}
                autoComplete="name"
                required
                autoFocus
                placeholder="Ada Chen"
                aria-invalid={Boolean(fieldErrors.display_name)}
                aria-describedby={
                  fieldErrors.display_name
                    ? "register-display-name-error"
                    : undefined
                }
              />
            </Field>

            <Field
              label="Legal name"
              htmlFor="register-legal-name"
              hint="Use only if passport or booking name differs."
              error={fieldErrors.legal_name}
            >
              <input
                id="register-legal-name"
                value={legalName}
                onChange={(event) => {
                  setLegalName(event.target.value);
                  clearFieldError("legal_name");
                }}
                className={fieldControlClass(Boolean(fieldErrors.legal_name))}
                autoComplete="off"
                placeholder="Same as preferred name if blank"
                aria-invalid={Boolean(fieldErrors.legal_name)}
                aria-describedby={
                  fieldErrors.legal_name
                    ? "register-legal-name-error"
                    : undefined
                }
              />
            </Field>
          </FormSection>

          <div className="border-t border-border/70" />

          <FormSection
            step={2}
            title="Contact"
            description="At least one of email or phone is required."
          >
            <Field
              label="Email"
              htmlFor="register-email"
              required
              error={fieldErrors.email}
            >
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError("email");
                }}
                className={fieldControlClass(Boolean(fieldErrors.email))}
                autoComplete="email"
                placeholder="ada@example.com"
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={
                  fieldErrors.email ? "register-email-error" : undefined
                }
              />
            </Field>

            <Field
              label="Phone"
              htmlFor="register-phone"
              required
              error={fieldErrors.phone}
            >
              <PhoneInput
                id="register-phone"
                value={phone}
                onChange={(value) => {
                  setPhone(value);
                  clearFieldError("phone", "email");
                }}
                defaultCountryHint={nationality || null}
                aria-required
                className={cn(
                  fieldErrors.phone && "[&_input]:border-red-400/70 [&_input]:ring-2 [&_input]:ring-red-400/40",
                )}
              />
            </Field>
            {contactHint === "missing" ? (
              <p className="text-xs text-red-600">
                Add an email or phone number so we can reach them.
              </p>
            ) : null}
            {contactHint === "hint" ? (
              <p className="text-xs text-ink-muted">
                Fill email, phone, or both — one is enough.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Best way to reach them"
                htmlFor="register-preferred"
                hint="How the team should contact this guest first."
                error={fieldErrors.preferred_contact_method}
              >
                <select
                  id="register-preferred"
                  value={preferredContact}
                  onChange={(event) => {
                    setPreferredContact(event.target.value as ContactMethod);
                    clearFieldError("preferred_contact_method");
                  }}
                  className={fieldControlClass(
                    Boolean(fieldErrors.preferred_contact_method),
                  )}
                  aria-invalid={Boolean(fieldErrors.preferred_contact_method)}
                  aria-describedby={
                    fieldErrors.preferred_contact_method
                      ? "register-preferred-error"
                      : undefined
                  }
                >
                  {PREFERRED_CONTACT_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              {showWhatsapp ? (
                <Field
                  label="WhatsApp"
                  htmlFor="register-whatsapp"
                  hint="Leave blank if same as phone."
                  error={fieldErrors.whatsapp}
                >
                  <PhoneInput
                    id="register-whatsapp"
                    value={whatsapp}
                    onChange={(value) => {
                      setWhatsapp(value);
                      clearFieldError("whatsapp");
                    }}
                    defaultCountryHint={nationality || null}
                    className={cn(
                      fieldErrors.whatsapp &&
                        "[&_input]:border-red-400/70 [&_input]:ring-2 [&_input]:ring-red-400/40",
                    )}
                  />
                </Field>
              ) : null}
            </div>
          </FormSection>

          {showSimilarPanel ? (
            <div className="sm:pl-10" aria-live="polite">
              <SimilarClientsPanel
                checking={checkingSimilar}
                matches={matches}
                acknowledged={acknowledgedDuplicates}
                onAcknowledge={() => setAcknowledgedSearchKey(searchKey)}
              />
            </div>
          ) : null}

          <div className="border-t border-border/70" />

          <FormSection
            step={3}
            title="Details"
            description="Optional now — helpful before the first trip."
          >
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Client tier</p>
              {tiers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tiers.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setTierId(tier.id)}
                      className={studioChipClass(tierId === tier.id)}
                      aria-pressed={tierId === tier.id}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-muted">
                  Tiers are not configured. The default will be applied on save.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nationality"
                htmlFor="register-nationality"
                error={fieldErrors.nationality}
              >
                <CountryCombobox
                  id="register-nationality"
                  value={nationality}
                  onChange={(value) => {
                    setNationality(value);
                    clearFieldError("nationality");
                  }}
                  placeholder="Search countries…"
                />
              </Field>
              <Field
                label="City of residence"
                htmlFor="register-city"
                error={fieldErrors.city_of_residence}
              >
                <input
                  id="register-city"
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value);
                    clearFieldError("city_of_residence");
                  }}
                  className={fieldControlClass(
                    Boolean(fieldErrors.city_of_residence),
                  )}
                  placeholder="e.g. New York"
                  aria-invalid={Boolean(fieldErrors.city_of_residence)}
                  aria-describedby={
                    fieldErrors.city_of_residence
                      ? "register-city-error"
                      : undefined
                  }
                />
              </Field>
            </div>

            <Field
              label="Team notes"
              htmlFor="register-internal-notes"
              hint="Private to Studio — never shared with the guest."
              error={fieldErrors.internal_notes}
            >
              <div className="relative">
                <textarea
                  id="register-internal-notes"
                  value={internalNotes}
                  onChange={(event) => {
                    setInternalNotes(event.target.value);
                    clearFieldError("internal_notes");
                  }}
                  rows={3}
                  className={cn(
                    fieldControlClass(Boolean(fieldErrors.internal_notes)),
                    "resize-y pr-9",
                  )}
                  placeholder="Referral, call preferences, private flags…"
                  aria-invalid={Boolean(fieldErrors.internal_notes)}
                  aria-describedby={
                    fieldErrors.internal_notes
                      ? "register-internal-notes-error"
                      : undefined
                  }
                />
                <LuLock
                  className="pointer-events-none absolute top-3 right-3 h-3.5 w-3.5 text-ink-muted"
                  aria-hidden
                />
              </div>
            </Field>

            <Field
              label="Guest notes"
              htmlFor="register-guest-notes"
              hint="May inform guest experience — keep guest-safe."
              error={fieldErrors.guest_notes}
            >
              <textarea
                id="register-guest-notes"
                value={guestNotes}
                onChange={(event) => {
                  setGuestNotes(event.target.value);
                  clearFieldError("guest_notes");
                }}
                rows={2}
                className={cn(
                  fieldControlClass(Boolean(fieldErrors.guest_notes)),
                  "resize-y",
                )}
                placeholder="Preferences safe to use with hotels or partners…"
                aria-invalid={Boolean(fieldErrors.guest_notes)}
                aria-describedby={
                  fieldErrors.guest_notes
                    ? "register-guest-notes-error"
                    : undefined
                }
              />
            </Field>
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs text-ink-muted sm:text-left">
              Profile enrichment comes after create.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link
                href={pageRoutes.clients}
                className={studioButtonClass(
                  "secondary",
                  "md",
                  "w-full sm:w-auto",
                )}
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!canSubmit}
                className={studioButtonClass(
                  "primary",
                  "md",
                  "w-full sm:w-auto",
                )}
                title={
                  needsDuplicateAck
                    ? "Confirm possible matches first, or open an existing client"
                    : undefined
                }
              >
                {submitLabel({
                  loading,
                  needsDuplicateAck,
                  hasPossibleDuplicates,
                })}
              </button>
            </div>
          </div>
        </form>
      </ContentSection>
    </PageStack>
  );
}
