export type Region = "Upstate" | "Lower Hudson Valley" | "New York City" | "Long Island";

export type ZoneLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K";

export type ZoneColumn =
  | "A_west"
  | "B_genesee"
  | "C_central"
  | "D_north"
  | "E_mohawk_valley"
  | "F_capital"
  | "G_hudson_valley"
  | "H_millwood"
  | "I_dunwoodie"
  | "J_new_york_city"
  | "K_long_island";

export interface Zone {
  letter: ZoneLetter;
  name: string;
  column: ZoneColumn;
  /** Display label, e.g. "J · New York City". */
  label: string;
  region: Region;
  color: string;
}

/** Muted, distinguishable region colors (chart series, legends). */
export const REGION_COLORS: Record<Region, string> = {
  Upstate: "#3f7d5b",
  "Lower Hudson Valley": "#b07a1c",
  "New York City": "#b3483c",
  "Long Island": "#2c7891",
};

export const REGIONS: readonly Region[] = ["Upstate", "Lower Hudson Valley", "New York City", "Long Island"];

const zone = (letter: ZoneLetter, name: string, column: ZoneColumn, region: Region): Zone => ({
  letter,
  name,
  column,
  label: `${letter} · ${name}`,
  region,
  color: REGION_COLORS[region],
});

/** All 11 NYISO zones in geographic order A → K. */
export const ZONES: readonly Zone[] = [
  zone("A", "West", "A_west", "Upstate"),
  zone("B", "Genesee", "B_genesee", "Upstate"),
  zone("C", "Central", "C_central", "Upstate"),
  zone("D", "North", "D_north", "Upstate"),
  zone("E", "Mohawk Valley", "E_mohawk_valley", "Upstate"),
  zone("F", "Capital", "F_capital", "Upstate"),
  zone("G", "Hudson Valley", "G_hudson_valley", "Lower Hudson Valley"),
  zone("H", "Millwood", "H_millwood", "Lower Hudson Valley"),
  zone("I", "Dunwoodie", "I_dunwoodie", "Lower Hudson Valley"),
  zone("J", "New York City", "J_new_york_city", "New York City"),
  zone("K", "Long Island", "K_long_island", "Long Island"),
];

export const ZONE_BY_COLUMN = Object.fromEntries(ZONES.map((z) => [z.column, z])) as Record<ZoneColumn, Zone>;
export const ZONE_BY_LETTER = Object.fromEntries(ZONES.map((z) => [z.letter, z])) as Record<ZoneLetter, Zone>;
