insert into lead_sources (code, name, source_type) values
  ('website', 'Website form', 'website'),
  ('manual', 'Manually added', 'manual'),
  ('referral', 'Referral', 'referral'),
  ('event', 'Event', 'event'),
  ('directory', 'Public directory', 'directory'),
  ('csv', 'CSV import', 'csv'),
  ('government_data', 'Government open data', 'government_data'),
  ('partner', 'Partner referral', 'partner')
on conflict (code) do nothing;
