CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  corp TEXT NOT NULL,
  region TEXT NOT NULL,
  yearmonth TEXT NOT NULL,
  office TEXT,
  submitted_by TEXT,
  submitted_at TEXT,
  date TEXT,
  currency TEXT,
  amount REAL,
  cny_amount REAL,
  vendor TEXT,
  headcount INTEGER,
  note TEXT,
  pre_approved INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_ym ON entries(yearmonth);
CREATE INDEX IF NOT EXISTS idx_entries_corp_region_ym ON entries(corp, region, yearmonth);
