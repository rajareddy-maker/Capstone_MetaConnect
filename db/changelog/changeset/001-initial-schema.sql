-- liquibase formatted sql

-- changeset metaconnect:001-create-extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- changeset metaconnect:002-create-connections-table
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    connector_type VARCHAR(50) NOT NULL,
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(255),
    username VARCHAR(255),
    password_encrypted TEXT,
    extra_params JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'UNTESTED',
    last_tested_at TIMESTAMP WITH TIME ZONE,
    last_ingested_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connections_type ON connections(connector_type);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_name ON connections(name);

-- changeset metaconnect:003-create-metadata-databases-table
CREATE TABLE IF NOT EXISTS metadata_databases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_connection_database_name UNIQUE(connection_id, name)
);

CREATE INDEX IF NOT EXISTS idx_metadata_databases_conn ON metadata_databases(connection_id);
CREATE INDEX IF NOT EXISTS idx_metadata_databases_name ON metadata_databases(name);

-- changeset metaconnect:004-create-metadata-schemas-table
CREATE TABLE IF NOT EXISTS metadata_schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    database_id UUID NOT NULL REFERENCES metadata_databases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_database_schema_name UNIQUE(database_id, name)
);

CREATE INDEX IF NOT EXISTS idx_metadata_schemas_db ON metadata_schemas(database_id);
CREATE INDEX IF NOT EXISTS idx_metadata_schemas_name ON metadata_schemas(name);

-- changeset metaconnect:005-create-metadata-tables-table
CREATE TABLE IF NOT EXISTS metadata_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_id UUID NOT NULL REFERENCES metadata_schemas(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    table_type VARCHAR(50) DEFAULT 'table',
    row_count BIGINT DEFAULT 0,
    size_bytes BIGINT DEFAULT 0,
    description TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_schema_table_name UNIQUE(schema_id, name)
);

CREATE INDEX IF NOT EXISTS idx_metadata_tables_schema ON metadata_tables(schema_id);
CREATE INDEX IF NOT EXISTS idx_metadata_tables_name ON metadata_tables(name);

-- changeset metaconnect:006-create-metadata-columns-table
CREATE TABLE IF NOT EXISTS metadata_columns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES metadata_tables(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    is_primary_key BOOLEAN DEFAULT FALSE,
    is_nullable BOOLEAN DEFAULT TRUE,
    ordinal_position INTEGER DEFAULT 0,
    description TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_table_column_name UNIQUE(table_id, name)
);

CREATE INDEX IF NOT EXISTS idx_metadata_columns_table ON metadata_columns(table_id);
CREATE INDEX IF NOT EXISTS idx_metadata_columns_name ON metadata_columns(name);

-- changeset metaconnect:007-create-ingestion-runs-table
CREATE TABLE IF NOT EXISTS ingestion_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    dag_run_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_conn ON ingestion_runs(connection_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status ON ingestion_runs(status);