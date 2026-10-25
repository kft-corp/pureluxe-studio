/**
 * One-off Hotels-sheet → kb_hotel_details.price_tier (+ optional property aliases).
 * Spec: docs/trip-builder-agent-redesign.md Stage 3a §25.
 *
 * Dry-run by default (prints the planned updates). Pass --apply to write.
 *
 *   node --require ./scripts/load-root-env.cjs ./scripts/import-hotel-tiers.cjs path/to/tiers.csv
 *   node --require ./scripts/load-root-env.cjs ./scripts/import-hotel-tiers.cjs path/to/tiers.csv --apply
 *
 * CSV columns: hotel_name, price_tier (ultra_luxury|luxury|premium), aliases (optional, | or , separated)
 */
require("./load-root-env.cjs");

const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const TIERS = new Set(["ultra_luxury", "luxury", "premium"]);

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("hotel_name");
  const tierIdx = header.indexOf("price_tier");
  const aliasIdx = header.indexOf("aliases");
  if (nameIdx < 0 || tierIdx < 0) {
    throw new Error("CSV needs hotel_name and price_tier columns.");
  }

  return lines.slice(1).map((line, i) => {
    const cols = splitCsvLine(line);
    const hotelName = (cols[nameIdx] ?? "").trim();
    const priceTier = (cols[tierIdx] ?? "").trim().toLowerCase();
    const aliasesRaw = aliasIdx >= 0 ? (cols[aliasIdx] ?? "").trim() : "";
    const aliases = aliasesRaw
      ? aliasesRaw.split(/[|,]/).map((a) => a.trim()).filter(Boolean)
      : [];
    if (!hotelName) throw new Error(`Row ${i + 2}: hotel_name is empty.`);
    if (!TIERS.has(priceTier)) {
      throw new Error(`Row ${i + 2}: price_tier must be ultra_luxury, luxury or premium (got "${priceTier}").`);
    }
    return { hotelName, priceTier, aliases };
  });
}

/** Minimal CSV split: supports quoted fields with commas. */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--apply");
  const apply = process.argv.includes("--apply");
  const csvPath = path.resolve(args[0] || path.join(__dirname, "hotel-tiers.example.csv"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`${apply ? "APPLY" : "DRY-RUN"} · ${rows.length} row(s) from ${csvPath}\n`);

  let matched = 0;
  let missingKb = 0;
  let missingProperty = 0;

  for (const row of rows) {
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, name, aliases")
      .eq("active", true)
      .ilike("name", `%${row.hotelName.replace(/[%_]/g, "\\$&")}%`)
      .limit(5);

    if (propError) throw propError;

    const exact =
      (properties ?? []).find((p) => p.name.toLowerCase() === row.hotelName.toLowerCase()) ??
      (properties?.length === 1 ? properties[0] : null);

    if (!exact) {
      missingProperty += 1;
      console.log(`MISS property · ${row.hotelName} → ${row.priceTier}`);
      if (properties?.length) {
        console.log(`  candidates: ${properties.map((p) => p.name).join("; ")}`);
      }
      continue;
    }

    const { data: entity, error: entError } = await supabase
      .from("kb_entities")
      .select("id, name")
      .eq("property_id", exact.id)
      .eq("entity_type", "hotel")
      .eq("active", true)
      .maybeSingle();

    if (entError) throw entError;

    if (!entity) {
      missingKb += 1;
      console.log(`MISS atlas · ${exact.name} (${exact.id}) — no kb_entities hotel link`);
      if (apply && row.aliases.length > 0) {
        const { error } = await supabase
          .from("properties")
          .update({ aliases: row.aliases })
          .eq("id", exact.id);
        if (error) throw error;
        console.log(`  aliases updated only`);
      }
      continue;
    }

    matched += 1;
    console.log(`OK · ${exact.name} → ${row.priceTier}${row.aliases.length ? ` · aliases: ${row.aliases.join(", ")}` : ""}`);

    if (!apply) continue;

    const { error: tierError } = await supabase
      .from("kb_hotel_details")
      .update({ price_tier: row.priceTier })
      .eq("entity_id", entity.id);
    if (tierError) throw tierError;

    if (row.aliases.length > 0) {
      const { error: aliasError } = await supabase
        .from("properties")
        .update({ aliases: row.aliases })
        .eq("id", exact.id);
      if (aliasError) throw aliasError;
    }
  }

  console.log(
    `\nSummary: matched ${matched}, missing property ${missingProperty}, missing atlas link ${missingKb}.`,
  );
  if (!apply) {
    console.log("Re-run with --apply after reviewing the list.");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
