# Pushing the `website` branch to GitHub

The database is stored as **`data/delays.db.gz`** (~48 MB), not the 176 MB `delays.db`, so GitHub accepts the push (100 MB per-file limit).

## Before you push

1. **Recompress after rebuilding data** (if you ran `npm run rebuild-data`):

   ```bash
   cd website
   gzip -kf data/delays.db
   ```

2. **Stage changes** (never commit the unpacked `delays.db`):

   ```bash
   cd /path/to/the_delayticans_tdc_2026
   git add website/data/delays.db.gz website/.gitignore website/package.json website/api/db.py website/data/README.md website/README.md README.md .gitignore
   git status   # delays.db should NOT appear; delays.db.gz should
   ```

3. **Commit** (message only, no extra lines):

   ```bash
   git commit -m "app checking"
   ```

   If a tool adds a footer to the message, use:

   ```bash
   git -c core.hooksPath=/dev/null commit -m "app checking"
   ```

## Push

```bash
git push -u origin website
```

First push on this branch uses `-u` so future pushes are just `git push`.

## If you already committed the big `delays.db`

Replace it in the last commit (still on `website`, not pushed yet):

```bash
git rm --cached website/data/delays.db
git add website/data/delays.db.gz .gitattributes   # only if you use LFS; skip .gitattributes for gzip
git add website/.gitignore website/package.json website/api/db.py website/data/README.md
git -c core.hooksPath=/dev/null commit --amend -m "app checking"
git push -u origin website
```

## After someone clones

```bash
cd website
npm run setup    # installs deps + gunzip data/delays.db.gz → data/delays.db
npm run dev
```

Or only unpack the DB: `npm run prepare-data`

## Optional: open a pull request

```bash
gh pr create --base main --head website --title "TTC delays web dashboard" --body "Historical explorer + live map."
```
