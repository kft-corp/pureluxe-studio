"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import {
  CountryCombobox,
  LanguageCombobox,
  PhoneInput,
  TimezoneCombobox,
} from "@/components/ui";
import { updateClient, upsertClientHealth } from "@/lib/api/clients";
import type { ClientProfile } from "@/lib/clients";
import {
  clientTitleSelectOptions,
  importantDateLabelSelectOptions,
  normalizeClientTitle,
  PREFERRED_CONTACT_OPTIONS,
} from "@/lib/clients";
import { showApiError, showOptionalSuccessToast, showWarningToast } from "@/lib/feedback/toast";
import { cn } from "@/lib/utils/cn";
import {
  clientMessages,
  composeE164,
  isValidCountryCode,
  isValidLanguageCode,
  isValidTimezone,
  listCountryOptions,
  parsePhoneParts,
} from "@pureluxe/shared";

function initialCountryCode(raw: string | null | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  if (isValidCountryCode(value)) return value.toUpperCase();
  const byName = listCountryOptions().find(
    (option) => option.name.toLowerCase() === value.toLowerCase(),
  );
  return byName?.code ?? "";
}
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>
      ) : null}
      {children}
    </label>
  );
}

type SectionFormProps = {
  profile: ClientProfile;
  onClose: () => void;
  onSuccess: (profile: ClientProfile) => void;
};

type DateRow = {
  label: string;
  date: string;
  recurring: boolean;
};

function SectionFormShell({
  title,
  description,
  loading,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          <ModalButton
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            form="client-section-form"
            variant="primary"
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Saving…" : "Save"}
          </ModalButton>
        </>
      }
    >
      <form
        id="client-section-form"
        onSubmit={onSubmit}
        className="min-w-0 space-y-4 overflow-x-hidden px-5 py-5"
      >
        {children}
      </form>
    </Modal>
  );
}

export function IdentityForm({ profile, onClose, onSuccess }: SectionFormProps) {
  const client = profile.client;
  const [displayName, setDisplayName] = useState(client.display_name);
  const [title, setTitle] = useState(() => normalizeClientTitle(client.title));
  const [firstName, setFirstName] = useState(client.first_name ?? "");
  const [lastName, setLastName] = useState(client.last_name ?? "");
  const [legalName, setLegalName] = useState(client.legal_name ?? "");
  const [company, setCompany] = useState(client.company ?? "");
  const [vipTier, setVipTier] = useState(client.tier.slug);
  const [loading, setLoading] = useState(false);
  const titleOptions = clientTitleSelectOptions(client.title);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      if (!displayName.trim()) {
        showWarningToast(clientMessages.error.displayNameRequired);
        setLoading(false);
        return;
      }

      const response = await updateClient(
        client.id,
        {
          display_name: displayName.trim(),
          title: title.trim() || null,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          legal_name: legalName.trim() || null,
          company: company.trim() || null,
          tier_slug: vipTier as "standard" | "vip" | "vvip",
        },
        {
          ifUnmodifiedSince: client.updated_at,
        },
      );
      onSuccess(response.data);
      onClose();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit name & identity"
      description="How we address this guest in Studio and on travel documents."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Preferred name" htmlFor="edit-display-name">
        <input
          id="edit-display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className={cn(modalFieldClassName)}
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="edit-title">
          <select
            id="edit-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={cn(modalFieldClassName)}
          >
            {titleOptions.map((option) => (
              <option key={option.value || "none"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Guest tier" htmlFor="edit-vip">
          <select
            id="edit-vip"
            value={vipTier}
            onChange={(event) =>
              setVipTier(event.target.value as "standard" | "vip" | "vvip")
            }
            className={cn(modalFieldClassName)}
          >
            <option value="standard">Standard</option>
            <option value="vip">VIP</option>
            <option value="vvip">VVIP</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="edit-first-name">
          <input
            id="edit-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
        <Field label="Last name" htmlFor="edit-last-name">
          <input
            id="edit-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
      </div>
      <Field label="Legal name" htmlFor="edit-legal-name">
        <input
          id="edit-legal-name"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
          className={cn(modalFieldClassName)}
        />
      </Field>
      <Field label="Company" htmlFor="edit-company">
        <input
          id="edit-company"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          className={cn(modalFieldClassName)}
        />
      </Field>
    </SectionFormShell>
  );
}

export function ContactForm({ profile, onClose, onSuccess }: SectionFormProps) {
  const client = profile.client;
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(() => {
    if (!client.phone?.trim()) return "";
    const parts = parsePhoneParts(client.phone);
    return composeE164(parts.country, parts.national) ?? "";
  });
  const [whatsapp, setWhatsapp] = useState(() => {
    if (!client.whatsapp?.trim()) return "";
    const parts = parsePhoneParts(client.whatsapp);
    return composeE164(parts.country, parts.national) ?? "";
  });
  const [preferredContact, setPreferredContact] = useState(
    client.preferred_contact_method ?? "",
  );
  const [language, setLanguage] = useState(() => {
    const value = client.preferred_language?.trim().toLowerCase() ?? "";
    return isValidLanguageCode(value) ? value : "";
  });
  const [timezone, setTimezone] = useState(() => {
    const value = client.timezone?.trim() ?? "";
    return isValidTimezone(value) ? value : "";
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      if (!email.trim() && !phone.trim()) {
        showWarningToast(clientMessages.error.contactRequired);
        setLoading(false);
        return;
      }

      const response = await updateClient(
        client.id,
        {
          email: email.trim() || null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          preferred_contact_method:
            preferredContact === "email" ||
            preferredContact === "phone" ||
            preferredContact === "whatsapp"
              ? (preferredContact as "email" | "phone" | "whatsapp")
              : null,
          preferred_language: language.trim() || null,
          timezone: timezone.trim() || null,
        },
        {
          ifUnmodifiedSince: client.updated_at,
        },
      );
      onSuccess(response.data);
      onClose();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit contact"
      description="Best ways to reach them before and during a trip."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Email" htmlFor="edit-email">
        <input
          id="edit-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={cn(modalFieldClassName)}
          autoComplete="email"
        />
      </Field>

      <Field label="Phone" htmlFor="edit-phone">
        <PhoneInput
          id="edit-phone"
          value={phone}
          onChange={setPhone}
          className="mt-1.5"
          defaultCountryHint={
            isValidCountryCode(client.nationality) ? client.nationality : null
          }
        />
      </Field>

      <Field label="WhatsApp" htmlFor="edit-whatsapp">
        <PhoneInput
          id="edit-whatsapp"
          value={whatsapp}
          onChange={setWhatsapp}
          className="mt-1.5"
          defaultCountryHint={
            isValidCountryCode(client.nationality) ? client.nationality : null
          }
        />
      </Field>

      <Field label="Best way to reach them" htmlFor="edit-preferred">
        <select
          id="edit-preferred"
          value={preferredContact}
          onChange={(event) => setPreferredContact(event.target.value)}
          className={cn(modalFieldClassName)}
        >
          <option value="">Not set</option>
          {PREFERRED_CONTACT_OPTIONS.filter((option) => option.value).map(
            (option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ),
          )}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Language" htmlFor="edit-language">
          <LanguageCombobox
            id="edit-language"
            value={language}
            onChange={setLanguage}
            placeholder="Search languages…"
          />
        </Field>
        <Field label="Timezone" htmlFor="edit-timezone">
          <TimezoneCombobox
            id="edit-timezone"
            value={timezone}
            onChange={setTimezone}
            placeholder="Search timezones…"
          />
        </Field>
      </div>
    </SectionFormShell>
  );
}

export function LocationForm({ profile, onClose, onSuccess }: SectionFormProps) {
  const client = profile.client;
  const [nationality, setNationality] = useState(() =>
    initialCountryCode(client.nationality),
  );
  const [cityOfResidence, setCityOfResidence] = useState(
    client.city_of_residence ?? "",
  );
  const [addressLine1, setAddressLine1] = useState(client.address_line_1 ?? "");
  const [addressLine2, setAddressLine2] = useState(client.address_line_2 ?? "");
  const [addressCity, setAddressCity] = useState(client.address_city ?? "");
  const [addressState, setAddressState] = useState(client.address_state ?? "");
  const [postalCode, setPostalCode] = useState(client.address_postal_code ?? "");
  const [addressCountry, setAddressCountry] = useState(() =>
    initialCountryCode(client.address_country),
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await updateClient(
        client.id,
        {
          nationality: nationality.trim() || null,
          city_of_residence: cityOfResidence.trim() || null,
          address_line_1: addressLine1.trim() || null,
          address_line_2: addressLine2.trim() || null,
          address_city: addressCity.trim() || null,
          address_state: addressState.trim() || null,
          address_postal_code: postalCode.trim() || null,
          address_country: addressCountry.trim() || null,
        },
        {
          ifUnmodifiedSince: client.updated_at,
        },
      );
      onSuccess(response.data);
      onClose();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit location & address"
      description="Where they live and their mailing address on file."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City of residence" htmlFor="edit-city-res">
          <input
            id="edit-city-res"
            value={cityOfResidence}
            onChange={(event) => setCityOfResidence(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
        <Field label="Nationality" htmlFor="edit-nationality">
          <CountryCombobox
            id="edit-nationality"
            value={nationality}
            onChange={setNationality}
            placeholder="Search countries…"
          />
        </Field>
      </div>
      <Field label="Address line 1" htmlFor="edit-addr1">
        <input
          id="edit-addr1"
          value={addressLine1}
          onChange={(event) => setAddressLine1(event.target.value)}
          className={cn(modalFieldClassName)}
        />
      </Field>
      <Field label="Address line 2" htmlFor="edit-addr2">
        <input
          id="edit-addr2"
          value={addressLine2}
          onChange={(event) => setAddressLine2(event.target.value)}
          className={cn(modalFieldClassName)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" htmlFor="edit-addr-city">
          <input
            id="edit-addr-city"
            value={addressCity}
            onChange={(event) => setAddressCity(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
        <Field label="State / region" htmlFor="edit-addr-state">
          <input
            id="edit-addr-state"
            value={addressState}
            onChange={(event) => setAddressState(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Postal code" htmlFor="edit-postal">
          <input
            id="edit-postal"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
        <Field label="Country" htmlFor="edit-country">
          <CountryCombobox
            id="edit-country"
            value={addressCountry}
            onChange={setAddressCountry}
            placeholder="Search countries…"
          />
        </Field>
      </div>
    </SectionFormShell>
  );
}

export function NotesForm({ profile, onClose, onSuccess }: SectionFormProps) {
  const client = profile.client;
  const [guestNotes, setGuestNotes] = useState(client.guest_notes ?? "");
  const [internalNotes, setInternalNotes] = useState(
    client.internal_notes ?? "",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await updateClient(
        client.id,
        {
          guest_notes: guestNotes.trim() || null,
          internal_notes: internalNotes.trim() || null,
        },
        {
          ifUnmodifiedSince: client.updated_at,
        },
      );
      onSuccess(response.data);
      onClose();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit notes"
      description="Experience notes may inform trips. Internal notes stay in Studio only."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field
        label="Experience notes"
        htmlFor="edit-guest-notes"
        hint="May inform guest experience — keep guest-safe."
      >
        <textarea
          id="edit-guest-notes"
          value={guestNotes}
          onChange={(event) => setGuestNotes(event.target.value)}
          rows={4}
          className={cn(modalFieldClassName, "resize-y")}
        />
      </Field>
      <Field
        label="Internal team notes"
        htmlFor="edit-internal-notes"
        hint="Studio only — never shared with the guest."
      >
        <textarea
          id="edit-internal-notes"
          value={internalNotes}
          onChange={(event) => setInternalNotes(event.target.value)}
          rows={4}
          className={cn(modalFieldClassName, "resize-y")}
        />
      </Field>
    </SectionFormShell>
  );
}

export function DatesForm({ profile, onClose, onSuccess }: SectionFormProps) {
  const client = profile.client;
  const [dateRows, setDateRows] = useState<DateRow[]>(
    (client.important_dates ?? []).map((row) => ({
      label: row.label,
      date: row.date,
      recurring: Boolean(row.recurring),
    })),
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await updateClient(
        client.id,
        {
          important_dates: dateRows
            .map((row) => ({
              label: row.label.trim(),
              date: row.date.trim(),
              recurring: row.recurring,
            }))
            .filter((row) => row.label && row.date),
        },
        {
          ifUnmodifiedSince: client.updated_at,
        },
      );
      onSuccess(response.data);
      onClose();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit important dates"
      description="Birthdays, anniversaries, and dates worth remembering."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="space-y-3">
        {dateRows.map((row, index) => (
          <div
            key={`date-${index}`}
            className="space-y-3 rounded-xl border border-border/80 p-3"
          >
            <Field label="Type" htmlFor={`date-label-${index}`}>
              <select
                id={`date-label-${index}`}
                value={row.label}
                onChange={(event) => {
                  const next = [...dateRows];
                  const label = event.target.value;
                  const yearlyByDefault =
                    label === "Birthday" ||
                    label === "Anniversary" ||
                    label === "Wedding anniversary" ||
                    label === "Partner's birthday" ||
                    label === "Child's birthday";
                  next[index] = {
                    ...row,
                    label,
                    recurring: yearlyByDefault ? true : row.recurring,
                  };
                  setDateRows(next);
                }}
                className={cn(modalFieldClassName)}
              >
                {importantDateLabelSelectOptions(row.label).map((option) => (
                  <option
                    key={option.value || "none"}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date" htmlFor={`date-value-${index}`}>
                <input
                  id={`date-value-${index}`}
                  type="date"
                  value={row.date}
                  onChange={(event) => {
                    const next = [...dateRows];
                    next[index] = { ...row, date: event.target.value };
                    setDateRows(next);
                  }}
                  className={cn(modalFieldClassName)}
                />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={row.recurring}
                  onChange={(event) => {
                    const next = [...dateRows];
                    next[index] = {
                      ...row,
                      recurring: event.target.checked,
                    };
                    setDateRows(next);
                  }}
                  className="rounded border-border"
                />
                Repeats yearly
              </label>
            </div>
            <button
              type="button"
              onClick={() =>
                setDateRows(dateRows.filter((_, i) => i !== index))
              }
              className="text-xs font-semibold text-red-700 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDateRows([
              ...dateRows,
              { label: "", date: "", recurring: false },
            ])
          }
          className="text-sm font-semibold text-ink-muted transition hover:text-ink"
        >
          + Add date
        </button>
      </div>
    </SectionFormShell>
  );
}

export function HealthForm({ profile, onClose, onSuccess }: SectionFormProps) {
  const client = profile.client;
  const health = client.health_profile;
  const [dietary, setDietary] = useState(
    (health?.dietary_restrictions ?? []).join(", "),
  );
  const [mobility, setMobility] = useState(health?.mobility_notes ?? "");
  const [medication, setMedication] = useState(health?.medication_notes ?? "");
  const [emergencyName, setEmergencyName] = useState(
    health?.emergency_contact_name ?? "",
  );
  const [emergencyPhone, setEmergencyPhone] = useState(() => {
    const raw = health?.emergency_contact_phone?.trim() ?? "";
    if (!raw) return "";
    const parts = parsePhoneParts(raw);
    return composeE164(parts.country, parts.national) ?? "";
  });
  const [shareWithHotels, setShareWithHotels] = useState(
    health?.share_with_hotels ?? false,
  );
  const [healthNotes, setHealthNotes] = useState(health?.notes ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await upsertClientHealth(client.id, {
        dietary_restrictions: dietary
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean),
        mobility_notes: mobility.trim() || null,
        medication_notes: medication.trim() || null,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        share_with_hotels: shareWithHotels,
        notes: healthNotes.trim() || null,
      });
      onSuccess(response.data);
      onClose();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit health & accessibility"
      description="Dietary needs and mobility details for hotels — handle with care."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field
        label="Dietary needs"
        htmlFor="edit-dietary"
        hint="Separate items with commas."
      >
        <input
          id="edit-dietary"
          value={dietary}
          onChange={(event) => setDietary(event.target.value)}
          className={cn(modalFieldClassName)}
          placeholder="Vegetarian, no shellfish"
        />
      </Field>
      <Field label="Mobility" htmlFor="edit-mobility">
        <textarea
          id="edit-mobility"
          value={mobility}
          onChange={(event) => setMobility(event.target.value)}
          rows={2}
          className={cn(modalFieldClassName, "resize-y")}
        />
      </Field>
      <Field label="Medication" htmlFor="edit-medication">
        <textarea
          id="edit-medication"
          value={medication}
          onChange={(event) => setMedication(event.target.value)}
          rows={2}
          className={cn(modalFieldClassName, "resize-y")}
        />
      </Field>
      <div className="space-y-4">
        <Field label="Emergency contact name" htmlFor="edit-em-name">
          <input
            id="edit-em-name"
            value={emergencyName}
            onChange={(event) => setEmergencyName(event.target.value)}
            className={cn(modalFieldClassName)}
            autoComplete="name"
          />
        </Field>
        <Field label="Emergency phone" htmlFor="edit-em-phone">
          <PhoneInput
            id="edit-em-phone"
            value={emergencyPhone}
            onChange={setEmergencyPhone}
            className="mt-1.5"
            defaultCountryHint={
              isValidCountryCode(client.nationality) ? client.nationality : null
            }
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={shareWithHotels}
          onChange={(event) => setShareWithHotels(event.target.checked)}
          className="rounded border-border"
        />
        Share with hotels
      </label>
      <Field label="Additional health notes" htmlFor="edit-health-notes">
        <textarea
          id="edit-health-notes"
          value={healthNotes}
          onChange={(event) => setHealthNotes(event.target.value)}
          rows={3}
          className={cn(modalFieldClassName, "resize-y")}
        />
      </Field>
    </SectionFormShell>
  );
}
