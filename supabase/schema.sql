-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Repos table
CREATE TABLE IF NOT EXISTS repos (
  id BIGSERIAL PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  description TEXT,
  language TEXT,
  last_sha TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on full_name for lookups
CREATE INDEX IF NOT EXISTS repos_full_name_idx ON repos(full_name);

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT REFERENCES repos(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  line_count INTEGER NOT NULL,
  last_sha TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, path)
);

-- Create index for file searches
CREATE INDEX IF NOT EXISTS files_repo_id_idx ON files(repo_id);
CREATE INDEX IF NOT EXISTS files_path_idx ON files USING gin(path gin_trgm_ops);
CREATE INDEX IF NOT EXISTS files_content_idx ON files USING to_tsvector('english', content);

-- Symbols table
CREATE TABLE IF NOT EXISTS symbols (
  id BIGSERIAL PRIMARY KEY,
  file_id BIGINT REFERENCES files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  parent_symbol TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for symbol searches
CREATE INDEX IF NOT EXISTS symbols_file_id_idx ON symbols(file_id);
CREATE INDEX IF NOT EXISTS symbols_name_idx ON symbols USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS symbols_kind_idx ON symbols(kind);
CREATE INDEX IF NOT EXISTS symbols_repo_idx ON symbols(files.repo_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_repos_updated_at BEFORE UPDATE ON repos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS but allow all via service role
ALTER TABLE repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE symbols ENABLE ROW LEVEL SECURITY;

-- Allow all operations (this is a personal tool)
CREATE POLICY "Allow all on repos" ON repos FOR ALL USING (true);
CREATE POLICY "Allow all on files" ON files FOR ALL USING (true);
CREATE POLICY "Allow all on symbols" ON symbols FOR ALL USING (true);
