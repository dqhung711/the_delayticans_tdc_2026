# Runtime data

| File | In git? | Purpose |
|------|---------|---------|
| `delays.db.gz` | Yes (~48 MB) | Historical delays (compressed) |
| `delays.db` | No (local) | Unpacked SQLite; run `npm run prepare-data` |
| `route-shapes-bus.json`, `route-shapes-streetcar.json` (+ `.json.gz` sidecars) | Yes | Map route lines (Toronto-clipped, simplified) |

After clone: `cd website && npm run setup` (unpacks the database).

Maintainers: rebuild with `npm run rebuild-data` (scripts in `.dev/tools/`).
