-- Operator confirm columns used by confirmInvoice. Applied on Neon already;
-- keep in repo so fresh environments do not rely on Workers DDL.
alter table invoices add column if not exists pay_method text;
alter table invoices add column if not exists wallet_address text;
alter table invoices add column if not exists tx_hash text;
