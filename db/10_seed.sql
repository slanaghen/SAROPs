-- ============================================================================
-- INITIAL DATA SEEDING (FOR DEVELOPMENT/FIRST-TIME SETUP)
-- ============================================================================
INSERT INTO users (email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills) 
VALUES (
  'admin@gmail.com', 
  'admin@gmail.com', 
  crypt('grigware', gen_salt('bf')), 
  'admin', 
  'Steve Admin', 
  'SAROps', 
  'SL-001', 
  '303-555-1234', 
  'SAR', 
  ''
) ON CONFLICT (email) DO NOTHING;
INSERT INTO users (email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills) 
VALUES (
  'staff@gmail.com', 
  'staff@gmail.com', 
  crypt('grigware', gen_salt('bf')), 
  'staff', 
  'Steve Staff', 
  'SAROps', 
  'SL-002', 
  '303-555-1234', 
  'SAR', 
  ''
) ON CONFLICT (email) DO NOTHING;
INSERT INTO users (email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills) 
VALUES (
  'responder@gmail.com', 
  'responder@gmail.com', 
  crypt('grigware', gen_salt('bf')), 
  'responder', 
  'Steve Responder', 
  'SAROps', 
  'SL-003', 
  '303-555-1234', 
  'SAR', 
  'Swiftwater Rescue, Paramedic'
) ON CONFLICT (email) DO NOTHING;