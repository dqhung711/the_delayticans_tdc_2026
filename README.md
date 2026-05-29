# the_delayticans_tdc_2026

TTC bus and streetcar delay analysis for TDC 2026.

## Web dashboard

See [`website/README.md`](website/README.md) for the interactive **TTC Delays** app (historical data explorer + live 3D map).

```bash
cd website
npm run setup   # venv + deps (first time)
npm run dev
```

Ship `website/data/` (including `delays.db.gz`) so clones work; see `website/PUSHING.md` to publish the branch.
