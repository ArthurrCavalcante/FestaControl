-- Create provider_credentials table
CREATE TABLE provider_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES company_connections(id) ON DELETE CASCADE,
    encrypted_access_token TEXT,
    phone_number_id TEXT,
    business_account_id TEXT,
    token_expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for provider_credentials
CREATE POLICY "Users can view their own company's credentials"
ON provider_credentials FOR SELECT
USING (
    connection_id IN (
        SELECT id FROM company_connections WHERE company_id IN (
            SELECT company_id FROM profiles WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can insert their own company's credentials"
ON provider_credentials FOR INSERT
WITH CHECK (
    connection_id IN (
        SELECT id FROM company_connections WHERE company_id IN (
            SELECT company_id FROM profiles WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can update their own company's credentials"
ON provider_credentials FOR UPDATE
USING (
    connection_id IN (
        SELECT id FROM company_connections WHERE company_id IN (
            SELECT company_id FROM profiles WHERE user_id = auth.uid()
        )
    )
);

-- Update company_connections to have more granular fields if needed
ALTER TABLE company_connections ADD COLUMN status TEXT DEFAULT 'ACTIVE';
ALTER TABLE company_connections ADD COLUMN connected_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE company_connections ADD COLUMN last_sync_at TIMESTAMPTZ;
