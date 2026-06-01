import sqlite3
from pathlib import Path

db_path = Path("website/data/delays.db")
if not db_path.exists():
    print(f"Error: {db_path} does not exist")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Schema ---")
for row in cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'"):
    print(row[0])

print("\n--- Indexes ---")
for row in cursor.execute("SELECT sql FROM sqlite_master WHERE type='index'"):
    if row[0]:
        print(row[0])

print("\n--- Row Count ---")
count = cursor.execute("SELECT COUNT(*) FROM delays").fetchone()[0]
print(f"Total rows: {count}")

conn.close()
