# Runtime data

| File | In git? | Purpose |
|------|---------|---------|
| `delays.db.gz` | Yes (~48 MB) | Historical delays (compressed) |
| `delays.db` | No (local) | Unpacked SQLite; run `npm run prepare-data` |
| `route-shapes.json`, `stops.*`, `route-modes.json` | Yes | Map + geocoding |

After clone: `cd website && npm run setup` (unpacks the database).

Maintainers: rebuild with `npm run rebuild-data` (scripts in `.dev/tools/`, gitignored).
