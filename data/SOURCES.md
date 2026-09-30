# Capital-city data

`capitals.js` contains 254 capital cities and selected national government seats, covering 244 countries and territories. It includes all 193 UN member states, both UN observer states, and additional countries and dependencies represented by GeoNames. The list is geographic reference data and does not imply a position on recognition or disputed status.

Coordinates, IANA time-zone identifiers, country names, and elevations are adapted from [GeoNames](https://www.geonames.org/), using the [countryInfo.txt](https://download.geonames.org/export/dump/countryInfo.txt) and [cities500.zip](https://download.geonames.org/export/dump/cities500.zip) extracts downloaded on 29 September 2026 UTC. The data is licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/); the full text is in [geonames-LICENSE.txt](geonames-LICENSE.txt). GeoNames' [format documentation](https://download.geonames.org/export/dump/readme.txt) describes the fields and underlying digital elevation models.

The browser receives only the small filtered catalogue. No GeoNames API account, live request, or external service is needed. `scripts/build_capitals.py` reproduces the catalogue from those two raw files; input SHA-256 hashes are recorded in the generated header.

## Selection and adaptations

- All `PPLC` records from the city extract are included.
- Explicit additions cover Cape Town and Bloemfontein; Sri Jayewardenepura Kotte; Jerusalem and East Jerusalem; Laayoune; and the government seats Cotonou, La Paz, Brades, Putrajaya, The Hague, Lobamba, and Ramallah.
- `PPLG` records are not included indiscriminately because that field also contained unrelated local places. The added government seats are individually identified in the generator.
- Display names are normalized for Washington, D.C., Palestine, Vatican City, and the Netherlands. Original/ASCII names remain searchable. Ngerulmud is taken from the city record rather than the older country-info capital label, Melekeok.
- When GeoNames has a reported elevation it is used; otherwise its DEM elevation is used. The unavailable DEM sentinel `-9999` is never used as an actual elevation. Suva and Monaco use a zero-metre fallback, labeled as estimated in the UI.
- City-centre coordinates and elevation estimates are a starting point; the observing-location editor accepts actual site coordinates, elevation, and time zone.

## Cross-checks for capital changes and multiple capitals

- [South African government](https://www.gov.za/about-sa/south-africas-provinces): Pretoria, Cape Town, and Bloemfontein.
- [Kotte Municipal Council](https://www.kotte.mc.gov.lk/index.php?Itemid=175&id=25&lang=en&option=com_content&view=article): Sri Jayewardenepura Kotte as Sri Lanka's administrative capital, alongside Colombo.
- [Equatorial Guinea government, 2 January 2026](https://www.guineaecuatorialpress.com/noticias/el_presidente_de_la_republica_proclama_la_ciudad_de_la_paz_como_capital_de_la_republica_de_guinea_ecuatorial_con_la_firma_de_un_decreto_ley): Ciudad de la Paz, reflected in the current GeoNames extract.
- [Indonesia's Constitutional Court, 12 May 2026](https://en.mkri.id/news/details/2026-05-12/Capital_Relocation_Depends_on_Issuance_of_Presidential_Decree): relocation from Jakarta to Nusantara depends on a presidential decree. This snapshot keeps Jakarta.
- [United Nations member-state list](https://www.un.org/about-us/member-states): the coverage test checks the 193 member-country ISO codes independently of the catalogue.

Countries, capital names, and time-zone rules can change. This is a bundled snapshot; rebuild and recheck these references when updating it. Daylight-saving transitions are resolved by the browser's IANA time-zone data.

## Rebuild

Download the two GeoNames files, then run:

```sh
python3 scripts/build_capitals.py /path/to/countryInfo.txt /path/to/cities500.zip data/capitals.js
npm test
```
