/** Standard hotel board / meals-included presets. */

export const BOARD_BASIS_PRESETS = [
  { code: "RO", label: "Room only" },
  { code: "BB", label: "Bed & breakfast" },
  { code: "HB", label: "Half board" },
  { code: "FB", label: "Full board" },
  { code: "AI", label: "All inclusive" },
] as const;

export type BoardBasisPresetCode =
  (typeof BOARD_BASIS_PRESETS)[number]["code"];

export function findBoardBasisPreset(
  value: string | null | undefined,
): (typeof BOARD_BASIS_PRESETS)[number] | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  return (
    BOARD_BASIS_PRESETS.find(
      (option) =>
        option.code === upper ||
        option.label.toLowerCase() === trimmed.toLowerCase(),
    ) ?? null
  );
}

/**
 * Resolve code + display label for service_details.
 * Standard pick → both; free text → label only (code cleared).
 */
export function resolveBoardBasisFields(input: {
  code: string;
  customLabel: string;
}): {
  board_basis: string | null;
  board_basis_label: string | null;
} {
  const code = input.code.trim();
  const custom = input.customLabel.trim();

  if (code) {
    const preset = findBoardBasisPreset(code);
    if (preset) {
      return {
        board_basis: preset.code,
        board_basis_label: preset.label,
      };
    }
  }

  if (custom) {
    const preset = findBoardBasisPreset(custom);
    if (preset) {
      return {
        board_basis: preset.code,
        board_basis_label: preset.label,
      };
    }
    return {
      board_basis: null,
      board_basis_label: custom,
    };
  }

  return { board_basis: null, board_basis_label: null };
}

/** Display preference: label, else mapped code, else raw code. */
export function formatBoardBasisDisplay(
  code: string | null | undefined,
  label: string | null | undefined,
): string | null {
  const trimmedLabel = label?.trim();
  if (trimmedLabel) {
    const preset = findBoardBasisPreset(code);
    if (preset && trimmedLabel === preset.label) {
      return `${preset.label} (${preset.code})`;
    }
    return trimmedLabel;
  }

  const trimmedCode = code?.trim();
  if (!trimmedCode) return null;
  const preset = findBoardBasisPreset(trimmedCode);
  if (preset) return `${preset.label} (${preset.code})`;
  return trimmedCode;
}

/** Form initial state from stored service_details. */
export function boardBasisFormStateFromDetails(details: {
  board_basis?: unknown;
  board_basis_label?: unknown;
}): { code: string; customLabel: string } {
  const code =
    typeof details.board_basis === "string" ? details.board_basis.trim() : "";
  const label =
    typeof details.board_basis_label === "string"
      ? details.board_basis_label.trim()
      : "";

  const preset = findBoardBasisPreset(code) ?? findBoardBasisPreset(label);
  if (preset && (!label || label === preset.label || !code)) {
    return { code: preset.code, customLabel: "" };
  }
  if (preset && label && label !== preset.label) {
    // Code present but custom label differs — treat as custom override.
    return { code: "", customLabel: label };
  }
  if (label) return { code: "", customLabel: label };
  if (code) {
    const known = findBoardBasisPreset(code);
    if (known) return { code: known.code, customLabel: "" };
    return { code: "", customLabel: code };
  }
  return { code: "", customLabel: "" };
}
