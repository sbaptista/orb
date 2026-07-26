#!/usr/bin/env node
/**
 * ORB-361: generate lib/data/city-zones.json — the city→IANA-timezone database
 * behind the todo editor's timezone picker.
 *
 * Source: GeoNames cities15000 dump (public domain, CC-BY 4.0 attribution in
 * the output header). Filtered to population >= 50,000 so "Boston" and
 * "Seattle" work without shipping every village on earth.
 *
 * Run once (network required), commit the output:
 *   node scripts/generate-city-zones.mjs
 *
 * Output shape: { attribution, generated, cities: [name, region, country, zone, population][] }
 * region is the admin-1 code for US/CA/AU (state/province disambiguation);
 * empty string elsewhere.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import path from 'path'

// 15k floor = the whole cities15000 dump. Chosen over 50k because the first
// casualties of a higher floor were Hawaiian towns (Kailua ~40k) — the gap
// would land exactly where Orb's users live.
const MIN_POPULATION = 15_000
const URL = 'https://download.geonames.org/export/dump/cities15000.zip'
const REGION_COUNTRIES = new Set(['US', 'CA', 'AU'])

// GeoNames uses numeric admin1 codes for CA and AU; map to familiar labels.
const CA_PROVINCES = { '01': 'AB', '02': 'BC', '03': 'MB', '04': 'NB', '05': 'NL', '07': 'NS', '08': 'ON', '09': 'PE', '10': 'QC', '11': 'SK', '12': 'YT', '13': 'NT', '14': 'NU' }
const AU_STATES = { '01': 'ACT', '02': 'NSW', '03': 'NT', '04': 'QLD', '05': 'SA', '06': 'TAS', '07': 'VIC', '08': 'WA' }

const work = path.join(tmpdir(), 'orb-city-zones')
mkdirSync(work, { recursive: true })
const zipPath = path.join(work, 'cities15000.zip')

console.log('Downloading', URL)
execSync(`curl -sfL -o ${zipPath} ${URL}`, { stdio: 'inherit' })
execSync(`cd ${work} && unzip -o -q cities15000.zip`)

const raw = execSync(`cat ${path.join(work, 'cities15000.txt')}`, { maxBuffer: 256 * 1024 * 1024 }).toString('utf8')

const cities = []
for (const line of raw.split('\n')) {
  if (!line) continue
  const f = line.split('\t')
  // GeoNames columns: 1=name, 8=country code, 10=admin1 code, 14=population, 17=timezone
  const name = f[1]
  const country = f[8]
  const admin1 = f[10] ?? ''
  const population = Number(f[14] ?? 0)
  const zone = f[17]
  if (!name || !zone || !zone.includes('/')) continue
  if (population < MIN_POPULATION) continue
  let region = REGION_COUNTRIES.has(country) ? admin1 : ''
  if (country === 'CA') region = CA_PROVINCES[admin1] ?? admin1
  if (country === 'AU') region = AU_STATES[admin1] ?? admin1
  cities.push([name, region, country, zone, population])
}

// Dedupe on (name, region, country) keeping the most populous.
const byKey = new Map()
for (const c of cities) {
  const key = `${c[0].toLowerCase()}|${c[1]}|${c[2]}`
  if (!byKey.has(key) || byKey.get(key)[4] < c[4]) byKey.set(key, c)
}
const list = [...byKey.values()].sort((a, b) => b[4] - a[4])

const out = {
  attribution: 'City data derived from GeoNames (geonames.org), CC-BY 4.0.',
  generated: new Date().toISOString().slice(0, 10),
  minPopulation: MIN_POPULATION,
  cities: list,
}

mkdirSync('lib/data', { recursive: true })
writeFileSync('lib/data/city-zones.json', JSON.stringify(out))
const kb = Math.round(JSON.stringify(out).length / 1024)
console.log(`Wrote lib/data/city-zones.json — ${list.length} cities, ~${kb} KB`)
