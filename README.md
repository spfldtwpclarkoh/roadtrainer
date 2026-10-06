# Springfield Township Road Trainer

A static web application for new hires at Springfield Township Fire Department in **Clark County, Ohio**. The township is orange; the other supplied county jurisdictions, including the City of Springfield, are blue.

## Use the trainer

- **Study map:** search township street names, select a street, and explore its address points on an OpenStreetMap street map. Switch between township and county views.
- **Name the street:** identify a highlighted street's address pattern from four choices. Practice shows real road geometry, neighboring road names, waterways, and landmarks, while hiding the tested street's own name.
- **Locate the street:** use neighboring road names and landmarks to find a named street, whose own map label stays hidden. Click near an address on it. An answer must be inside the township and within 200 metres of a supplied address on that street. Keyboard users can pan the map and submit its centre. Zoom in to see more local road names.
- Each practice drill has ten different streets, shows the labeled map after each answer, and provides a list of missed streets for review. Ending or leaving a drill discards its session; scores are not stored.

## Upload to GitHub

1. Create a GitHub repository.
2. Upload **the contents of this `road-trainer` folder** to the repository root. Include the hidden `.github` folder, which contains the deployment workflow. Do not upload `node_modules`.
3. In the repository, open **Settings → Pages** and set the source to **GitHub Actions**.
4. Push to the `main` branch, or run **Deploy road trainer to GitHub Pages** from the Actions tab. GitHub supplies the published URL when deployment completes.

The complete ready-to-serve app is already in `dist/`. It works under a repository subpath and needs no backend, API key, or build on GitHub. You can also host the contents of `dist/` on any static web host. Public GitHub Pages makes the included geographic data publicly accessible.

## Preview locally

Install Node.js, open a terminal in this folder, and run:

```sh
npm start
```

Open `http://127.0.0.1:4173`. Do not open `index.html` directly from the filesystem; browser security blocks geographic data loading through `file://`.

## Update the data

The original `Geo Files` and `Assets` folders remain untouched beside this project. The browser loads compact, derived data rather than the original 84 MB county address file. Generated data and the department logo are included in `dist/`, so those original folders are not needed to deploy.

To regenerate, keep those folders alongside `road-trainer`, then run:

```sh
npm ci
npm run prepare-data
npm run build
npm test
```

Alternatively, pass the geographic folder to `node scripts/prepare-data.mjs "PATH/TO/Geo Files"`. The script expects the original filenames `Address.geojson`, `TownshipBoundries.geojson`, and `MunicipalBoundary.geojson`.

Practice map context is a bundled OpenStreetMap snapshot, so trainees do not need an API key or a live data query. Refresh that optional public map snapshot with `npm run refresh-map-context` (internet access required). The script downloads roads, waterways, and named parks, schools, hospitals, and fire stations around the township. It preserves the prior snapshot if the request fails. Address-based township training scope continues to come exclusively from the supplied Geo Files.

## Geographic scope and limits

- Streets come from address points **geometrically inside** the supplied Springfield Township MultiPolygon, respecting every separate part and polygon hole. Points inside supplied incorporated municipalities are excluded as well. Postal city names are not used to determine jurisdiction.
- Street names retain prefix, type, and suffix fields. Duplicate coordinate/address combinations on a street are removed. Streets with no supplied township addresses cannot appear in the training list.
- **Dots are address locations.** Real road lines in practice come from the bundled OpenStreetMap snapshot, not inferred connections between addresses. Quiz selection and location scoring still use the supplied township addresses. Surrounding jurisdictions may appear for orientation but are never added to the training list.
- Raster street tiles are replaced during unanswered questions with a local road map so labels can be controlled individually. Tested street names and common directional/abbreviated variants are suppressed; nearby labels right on the tested address pattern are also suppressed as a precaution. Neighboring street and landmark labels are placed without overlaps and additional local street names appear when you zoom in.
- The county context is rendered from all supplied township and municipal polygons; no separate county boundary file was supplied. Source geometries are retained at their original precision. Displayed address coordinates are rounded to six decimal places.
- This is a training reference using the supplied data snapshot. It does not supply dispatch routing, travel times, or live street updates.

## Dependencies and attribution

Leaflet 1.9.4 is included locally under `dist/vendor/`, with its license. `npm run build` refreshes those files from the pinned package. Study and answer-review maps request street tiles from OpenStreetMap. Visible attribution links to [OpenStreetMap contributors](https://www.openstreetmap.org/copyright); the application does not prefetch or download tile regions. Hosting and use must follow the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/). An internet connection is required for those tiles; local boundaries and drills can operate without them once the app and data are loaded. Use an appropriate tile provider if usage grows beyond the public service's capacity.

The separate practice-context dataset `dist/data/map-context.geojson` is derived from **© OpenStreetMap contributors**, available under [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). That file records its download time and source database timestamp. It remains separate from the owner-supplied address and boundary data; its license does not grant rights to those supplied assets. Visible attribution remains on practice maps as well as study maps.

The department logo and geographic input files were supplied by the project owner. Confirm redistribution rights for those assets before making the repository public. No license for the supplied GIS data or department logo is inferred.

Optional browser WebMCP tools expose the existing street selection and drill-start actions when supported. They are feature-detected; ordinary browsers do not require them.
