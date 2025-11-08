-- Sales Quotation Memory System Database Schema

-- Materials table with source tracking
CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    hsn_code TEXT,
    source TEXT NOT NULL CHECK (source IN ('master', 'gmail', 'manual_ui')) DEFAULT 'master',
    normalized_name TEXT NOT NULL, -- For matching Gmail entries
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(normalized_name, source)
);

-- Clients table with source tracking
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    contact TEXT,
    source TEXT NOT NULL CHECK (source IN ('master', 'gmail', 'manual_ui')) DEFAULT 'master',
    normalized_name TEXT NOT NULL, -- For matching Gmail entries
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(normalized_name, source)
);

-- Price history table for tracking all quotations
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    rate_per_unit DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    unit TEXT NOT NULL,
    quantity DECIMAL(10,3),
    ex_works DECIMAL(10,2),
    ex_works_location TEXT,
    delivery_cost DECIMAL(10,2),
    quoted_at DATETIME NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gmail', 'manual_ui')) DEFAULT 'manual_ui',
    email_thread_id TEXT, -- Gmail thread ID for reference
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Quotes table for saved/draft quotes
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    quote_number TEXT,
    status TEXT CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')) DEFAULT 'draft',
    total_amount DECIMAL(12,2),
    currency TEXT DEFAULT 'INR',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Quote line items
CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit TEXT NOT NULL,
    rate_per_unit DECIMAL(10,2) NOT NULL,
    ex_works DECIMAL(10,2),
    ex_works_location TEXT,
    delivery_cost DECIMAL(10,2),
    delivery_terms TEXT DEFAULT 'From Ready Stock',
    line_total DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- Gmail ingestion log for tracking processed emails
CREATE TABLE IF NOT EXISTS gmail_ingestion_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL UNIQUE,
    message_id TEXT NOT NULL,
    subject TEXT,
    sender_email TEXT,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    items_extracted INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('success', 'partial', 'failed')) DEFAULT 'success',
    error_message TEXT
);

-- Material aliases table for fuzzy matching and learning
CREATE TABLE IF NOT EXISTS material_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    alias TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual', 'learned', 'correction')) DEFAULT 'manual',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    UNIQUE(alias, material_id)
);

-- Parsing history for analytics and improvement
CREATE TABLE IF NOT EXISTS parsing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT,
    method TEXT NOT NULL CHECK (method IN ('html_table', 'gpt-4o-mini', 'hybrid')),
    confidence DECIMAL(3,2) NOT NULL,
    items_extracted INTEGER NOT NULL DEFAULT 0,
    processing_time_ms INTEGER,
    cost_usd DECIMAL(8,6),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Parsing failures for debugging and improvement
CREATE TABLE IF NOT EXISTS parsing_failures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT,
    method TEXT NOT NULL,
    error TEXT NOT NULL,
    email_subject TEXT,
    email_body_length INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Review queue for low-confidence extractions
CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,
    thread_id TEXT,
    subject TEXT,
    sender_email TEXT,
    extracted_data TEXT, -- JSON of extracted items
    confidence DECIMAL(3,2) NOT NULL,
    method TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'corrected')) DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at DATETIME,
    corrections TEXT, -- JSON of corrections made
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_materials_normalized ON materials(normalized_name);
CREATE INDEX IF NOT EXISTS idx_clients_normalized ON clients(normalized_name);
CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON price_history(material_id, client_id, quoted_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_material ON price_history(material_id, quoted_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmail_thread ON gmail_ingestion_log(thread_id);
CREATE INDEX IF NOT EXISTS idx_material_aliases_lookup ON material_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_parsing_history_method ON parsing_history(method, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status, created_at DESC);

-- Triggers to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_materials_timestamp 
    AFTER UPDATE ON materials
    BEGIN
        UPDATE materials SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_clients_timestamp 
    AFTER UPDATE ON clients
    BEGIN
        UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_quotes_timestamp 
    AFTER UPDATE ON quotes
    BEGIN
        UPDATE quotes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
