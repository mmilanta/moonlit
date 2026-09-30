"""Build a small offline capital catalogue from GeoNames countryInfo.txt and cities500.zip.

Usage: python3 scripts/build_capitals.py COUNTRY_INFO CITIES_ZIP OUTPUT
The raw worldwide extracts are build inputs only; they are not shipped to browsers.
"""
import hashlib
import json
from pathlib import Path
import sys
import unicodedata
import zipfile

# Explicit additions: multiple capitals and verified seats of national government.
# PPLG is not used indiscriminately: the extract also contains unrelated local entries.
ADDITIONS = {
    "2394819": "government seat",   # Cotonou, Benin
    "3911925": "government seat",   # La Paz, Bolivia
    "7266440": "government seat",   # Brades, Montserrat
    "6697380": "administrative capital",  # Putrajaya, Malaysia
    "2747373": "government seat",   # The Hague, Netherlands
    "935048": "royal and legislative capital",  # Lobamba, Eswatini
    "1238992": "administrative capital",  # Sri Jayewardenepura Kotte, Sri Lanka
    "1018725": "judicial capital",  # Bloemfontein, South Africa
    "3369157": "legislative capital",  # Cape Town, South Africa
    "281184": "capital",           # Jerusalem, Israel
    "7303419": "claimed capital",  # East Jerusalem, Palestine
    "282239": "administrative centre",  # Ramallah, Palestine
    "2462881": "administrative centre",  # Laayoune, Western Sahara
}
COUNTRY_NAMES = {"PS": "Palestine", "VA": "Vatican City", "NL": "Netherlands"}
CITY_NAMES = {"4140963": "Washington, D.C."}

def build(country_path, cities_path):
    countries = {}
    for line in Path(country_path).read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        fields = line.split("\t")
        countries[fields[0]] = fields
    with zipfile.ZipFile(cities_path) as archive:
        rows = [line.split("\t") for line in archive.read("cities500.txt").decode().splitlines()]
    cities = []
    found_additions = set()
    for row in rows:
        if row[7] != "PPLC" and row[0] not in ADDITIONS:
            continue
        if row[0] in ADDITIONS:
            found_additions.add(row[0])
        country = countries[row[8]]
        country_name = COUNTRY_NAMES.get(row[8], country[4].strip())
        city_name = CITY_NAMES.get(row[0], row[1])
        elevation = next((int(value) for value in row[15:17] if value and value != "-9999"), 0)
        cities.append({
            "id": "london" if row[0] == "2643743" else f"capital-{row[8].lower()}-{row[0]}",
            "city": city_name, "country": country_name, "countryCode": row[8],
            "lat": float(row[4]), "lon": float(row[5]), "elevation": elevation,
            "zone": row[17], "geonameId": int(row[0]),
            "role": ADDITIONS.get(row[0], "capital"),
            "aliases": list(dict.fromkeys(name for name in [row[1], row[2], country[5].strip()]
                                          if name and name != city_name)),
            "elevationSource": "GeoNames elevation" if row[15] and row[15] != "-9999"
                else "GeoNames DEM" if row[16] and row[16] != "-9999" else "sea-level fallback",
        })
    assert found_additions == ADDITIONS.keys(), f"Missing additions: {ADDITIONS.keys() - found_additions}"
    cities.sort(key=lambda city: unicodedata.normalize("NFKD", city["city"]).casefold())
    return cities

if __name__ == "__main__":
    country_path, cities_path, output = sys.argv[1:]
    cities = build(country_path, cities_path)
    hashes = [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in [country_path, cities_path]]
    header = f"""/* Capital cities and government seats, derived from GeoNames.
 * Source: https://download.geonames.org/export/dump/ (snapshot 2026-09-29).
 * CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
 * Changes: filtered, supplemented, normalized names, and elevation fallback.
 * Attribution and scope: data/SOURCES.md; license: data/geonames-LICENSE.txt.
 * countryInfo SHA-256: {hashes[0]}
 * cities500 SHA-256: {hashes[1]}
 */
(function (root, factory) {{
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CapitalCities = factory();
}})(globalThis, function () {{ return [
"""
    body = ",\n".join("  " + json.dumps(city, ensure_ascii=False, separators=(",", ":")) for city in cities)
    Path(output).write_text(header + body + "\n]; });\n")
    print(f"Wrote {len(cities)} cities covering {len(set(c['countryCode'] for c in cities))} countries and territories.")
