alter table invoices add column if not exists provider text;
alter table invoices add column if not exists provider_payment_id text;
alter table invoices add column if not exists pay_currency text;
alter table invoices add column if not exists price_amount text;
alter table invoices add column if not exists provider_expires_at timestamptz;
alter table gifts add column if not exists reserved_climax boolean not null default false;
