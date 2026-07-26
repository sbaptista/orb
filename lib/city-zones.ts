/**
 * ORB-361: city-name → IANA-timezone search behind the todo editor's picker.
 *
 * Backed by lib/data/city-zones.json (33k+ GeoNames cities, population ≥ 15k,
 * regenerate via scripts/generate-city-zones.mjs). The dataset is loaded via
 * dynamic import the first time the picker is focused, so it costs nothing on
 * ordinary page loads. Until it arrives, callers fall back to the bare IANA
 * city list from lib/due-time.ts — the picker is never dead, just briefly
 * shallower.
 */
import { zoneDisplayLabel } from './due-time'

export type CitySearchResult = {
  zone: string
  city: string
  /** Disambiguator: "MA", "BC", or a country name — empty for unambiguous majors. */
  detail: string
  /** Zone label, e.g. "Eastern Time (EDT)". */
  label: string
}

type CityRow = [name: string, region: string, country: string, zone: string, population: number]

let db: CityRow[] | null = null
let loading: Promise<boolean> | null = null

const regionNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null

function countryName(code: string): string {
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}

/** Kick off (or await) the dataset load. Resolves true once rows are available. */
export function ensureCityZones(): Promise<boolean> {
  if (db) return Promise.resolve(true)
  if (!loading) {
    loading = import('./data/city-zones.json')
      .then(mod => {
        db = (mod.default ?? mod).cities as CityRow[]
        return true
      })
      .catch(err => {
        console.warn('[city-zones] dataset load failed, IANA fallback stays active:', err)
        loading = null
        return false
      })
  }
  return loading
}

export function cityZonesReady(): boolean {
  return db !== null
}

/**
 * Search by city-name prefix/substring. Rows are population-sorted in the
 * dataset, so prefix matches surface the famous city first (Boston MA before
 * Boston UK) without any extra ranking pass.
 */
export function searchCities(query: string, limit = 8): CitySearchResult[] {
  if (!db) return []
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts: CityRow[] = []
  const contains: CityRow[] = []
  for (const row of db) {
    const name = row[0].toLowerCase()
    if (name.startsWith(q)) starts.push(row)
    else if (name.includes(q)) contains.push(row)
    if (starts.length >= limit) break
  }
  return [...starts, ...contains].slice(0, limit).map(([name, region, country, zone]) => ({
    zone,
    city: name,
    detail: region || countryName(country),
    label: zoneDisplayLabel(zone),
  }))
}
