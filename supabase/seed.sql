-- ============================================================================
-- SEED DATA: TrueBid Development Environment
-- ============================================================================
-- Creates a usable local app after `supabase db reset`
--
-- ⚠️  LOCAL ONLY — DO NOT RUN AGAINST STAGING OR PRODUCTION ⚠️
--
-- This seed file inserts directly into auth.users, which ONLY works with
-- local Supabase (Docker). Hosted Supabase (staging/prod) uses GoTrue,
-- which rejects direct SQL inserts — users created this way cannot log in.
--
-- For staging/production user setup, use the Supabase Admin API:
--   npx tsx scripts/fix-staging-auth.ts
--
-- Contents:
--   1. FFTC company + synthetic auth user (Lapedra)
--   2. Tenant + membership (owner role)
--   3. company_settings with FY2026 rates (43/21/15) and profit targets
--   4. Labor categories (11 IC roles with salary_levels)
--   5. GSA rates (28 ceiling rates across 4 SINs)
--   6. Sample proposal with working_data for Roles & Pricing tab
--
-- Email: lapedra@cityfriends.tech (synthetic user for local testing)
-- ============================================================================

-- =============================================================================
-- 1. SYNTHETIC AUTH USER (Lapedra)
-- =============================================================================
-- ⚠️  LOCAL ONLY: Direct auth.users inserts bypass GoTrue.
-- Hosted Supabase (staging/prod) will reject logins for these users.
--
-- For staging/prod: Use scripts/fix-staging-auth.ts or Supabase Studio
-- to create users via the Admin API (auth.admin.createUser).
--
-- Password: 'password123' (bcrypt hash below)

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at,
  aud,
  role,
  confirmation_token,
  recovery_token
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'lapedra@cityfriends.tech',
  -- bcrypt hash of 'password123'
  '$2a$10$PznXR1v8RAZ7K8HVcVN3IONsb9UtH0TaCvKf7X3Q9hMpP5nXmQK6u',
  NOW(),
  '{"full_name": "Lapedra Tolson", "avatar_url": null}'::JSONB,
  '{"provider": "email", "providers": ["email"]}'::JSONB,
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Also create the identity record (required by Supabase Auth)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub": "11111111-1111-1111-1111-111111111111", "email": "lapedra@cityfriends.tech"}'::JSONB,
  'email',
  'lapedra@cityfriends.tech',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. FFTC COMPANY
-- =============================================================================

INSERT INTO companies (
  id,
  name,
  legal_name,
  sam_uei,
  cage_code,
  duns,
  ein,
  naics_codes,
  address,
  gsa_contract_number,
  gsa_mas_schedule,
  gsa_config,
  owner_id,
  created_at,
  updated_at
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'FFTC',
  'Fluent For The Culture, LLC',
  'SEEDUEI00001',
  'SEEDCG',
  '123456789',
  '12-3456789',
  ARRAY['541511', '541512', '541519', '541611'],
  '{"street": "123 Innovation Way", "city": "Washington", "state": "DC", "zip": "20001"}'::JSONB,
  '47QTCA23D0076',
  true,
  '{
    "gsaMasSchedule": true,
    "gsaContractNumber": "47QTCA23D0076",
    "gsaEscalationRate": 0.052,
    "gsaBaseYear": 2023,
    "gsaSins": ["54151S", "541611", "541910", "518210C"]
  }'::JSONB,
  '11111111-1111-1111-1111-111111111111',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3. COMPANY SETTINGS (FY2026 rates + profit targets)
-- =============================================================================
-- Indirect rates: Fringe 21.16%, Overhead 34.26%, G&A 19.83%
-- Profit targets: T&M 8%, GSA 5%, FFP Low 10%, FFP Medium 12%

INSERT INTO company_settings (
  id,
  company_id,
  fringe_rate,
  overhead_rate,
  ga_rate,
  profit_rate,
  standard_hours,
  fiscal_year,
  rate_source,
  profit_targets,
  content_library,
  created_at,
  updated_at
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  0.2116,
  0.3426,
  0.1983,
  0.10,
  2080,
  2026,
  'internal',
  '{
    "tm": 0.08,
    "gsa": 0.05,
    "ffp": 0.10,
    "ffpMedium": 0.12,
    "cpff": 0.08,
    "cpif": 0.10,
    "hybrid": 0.10
  }'::JSONB,
  '[]'::JSONB,
  NOW(),
  NOW()
) ON CONFLICT (company_id) DO UPDATE SET
  fringe_rate = EXCLUDED.fringe_rate,
  overhead_rate = EXCLUDED.overhead_rate,
  ga_rate = EXCLUDED.ga_rate,
  profit_rate = EXCLUDED.profit_rate,
  profit_targets = EXCLUDED.profit_targets,
  fiscal_year = EXCLUDED.fiscal_year,
  updated_at = NOW();

-- =============================================================================
-- 4. TENANT + MEMBERSHIP (Phase 1 multi-tenancy)
-- =============================================================================

INSERT INTO tenants (
  id,
  name,
  slug,
  status,
  company_id,
  created_by,
  created_at,
  updated_at
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  'FFTC',
  'fftc',
  'active',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO tenant_memberships (
  id,
  tenant_id,
  user_id,
  role,
  status,
  joined_at,
  invited_by
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  'owner',
  'active',
  NOW(),
  NULL
) ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- =============================================================================
-- 5. LABOR CATEGORIES (11 IC roles with salary_levels)
-- =============================================================================
-- Matches production data from fftc-roles-v2.json

INSERT INTO company_roles (id, company_id, title, labor_category, description, soc_code, soc_title, education, functional_responsibilities, certifications, salary_levels, created_at, updated_at) VALUES
-- Back-end Developer
('a0010000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Back-end Developer', 'Software Developer', 'Designs, develops, and maintains server-side applications, APIs, and databases. Responsible for application logic, performance, and integration with front-end systems.', '15-1252', 'Software Developers', '{"minimum": "Bachelor''s Degree"}'::JSONB, '4 years of experience', ARRAY[]::TEXT[], '[
  {"level": "IC1", "level_title": "Associate", "steps": [87000, 89610]},
  {"level": "IC2", "level_title": "Intermediate", "steps": [102000, 105060, 108212]},
  {"level": "IC3", "level_title": "Mid-Level", "steps": [120000, 123600, 127308]},
  {"level": "IC4", "level_title": "Senior", "steps": [142000, 146260, 150648]},
  {"level": "IC5", "level_title": "Staff", "steps": [170000, 175100, 180353, 185764, 191337]}
]'::JSONB, NOW(), NOW()),

-- Front-end Developer
('a0020000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Front-end Developer', 'Software Developer', 'Builds and maintains user-facing web applications. Focuses on UI implementation, accessibility compliance, performance optimization, and integration with back-end APIs.', '15-1252', 'Software Developers', '{"minimum": "Bachelor''s Degree"}'::JSONB, '4 years of experience', ARRAY[]::TEXT[], '[
  {"level": "IC1", "level_title": "Associate", "steps": [92000, 94760]},
  {"level": "IC2", "level_title": "Intermediate", "steps": [108000, 111240, 114577]},
  {"level": "IC3", "level_title": "Mid-Level", "steps": [128000, 131840, 135795]},
  {"level": "IC4", "level_title": "Senior", "steps": [143000, 147290, 151709]},
  {"level": "IC5", "level_title": "Staff", "steps": [160000, 164800, 169744, 174836, 180081]}
]'::JSONB, NOW(), NOW()),

-- DevOps Engineer
('a0030000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'DevOps Engineer', 'DevOps / Infrastructure Engineer', 'Manages CI/CD pipelines, cloud infrastructure, containerization, and deployment automation. Ensures system reliability, scalability, and security across development and production environments.', '15-1244', 'Network and Computer Systems Administrators', '{"minimum": "Bachelor''s Degree"}'::JSONB, '4 years of experience', ARRAY['AWS Certified Solutions Architect', 'AWS Certified DevOps Engineer'], '[
  {"level": "IC1", "level_title": "Associate", "steps": [87000, 89610]},
  {"level": "IC2", "level_title": "Intermediate", "steps": [102000, 105060, 108212]},
  {"level": "IC3", "level_title": "Mid-Level", "steps": [120000, 123600, 127308]},
  {"level": "IC4", "level_title": "Senior", "steps": [142000, 146260, 150648]},
  {"level": "IC5", "level_title": "Staff", "steps": [170000, 175100, 180353, 185764, 191337]}
]'::JSONB, NOW(), NOW()),

-- QA Engineer
('a0040000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'QA Engineer', 'Software Quality Assurance Analyst', 'Develops and executes test plans, automated test suites, and quality assurance processes. Identifies defects, ensures software meets requirements, and maintains quality standards across the development lifecycle.', '15-1253', 'Software Quality Assurance Analysts and Testers', '{"minimum": "Bachelor''s Degree"}'::JSONB, '4 years of experience', ARRAY['ISTQB Certified Tester'], '[
  {"level": "IC1", "level_title": "Associate", "steps": [75000, 77250]},
  {"level": "IC2", "level_title": "Intermediate", "steps": [88000, 90640, 93359]},
  {"level": "IC3", "level_title": "Mid-Level", "steps": [103000, 106090, 109273]},
  {"level": "IC4", "level_title": "Senior", "steps": [120000, 123600, 127308]},
  {"level": "IC5", "level_title": "Staff", "steps": [142000, 146260, 150648, 155167, 159822]}
]'::JSONB, NOW(), NOW()),

-- Product Manager
('a0050000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Product Manager', 'Product Manager', 'Defines product vision, strategy, and roadmap. Collaborates with engineering, design, and stakeholders to prioritize features, manage delivery, and ensure products meet user and mission needs.', '15-2051', 'Data Scientists', '{"minimum": "Bachelor''s Degree"}'::JSONB, '6 years of experience', ARRAY['Certified Scrum Product Owner (CSPO)', 'SAFe Product Owner/Product Manager'], '[
  {"level": "IC1", "level_title": "Associate", "steps": [90000, 92700]},
  {"level": "IC2", "level_title": "Intermediate", "steps": [106000, 109180, 112455]},
  {"level": "IC3", "level_title": "Mid-Level", "steps": [125000, 128750, 132613]},
  {"level": "IC4", "level_title": "Senior", "steps": [140000, 144200, 148526]},
  {"level": "IC5", "level_title": "Staff", "steps": [158000, 162740, 167622, 172651, 177831]}
]'::JSONB, NOW(), NOW()),

-- Product Designer
('a0060000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'Product Designer', 'UX/UI Designer', 'Leads end-to-end product design including user research, information architecture, interaction design, and visual design. Creates accessible, user-centered interfaces for government digital services.', '15-1255', 'Web and Digital Interface Designers', '{"minimum": "Bachelor''s Degree"}'::JSONB, '4 years of experience', ARRAY[]::TEXT[], '[
  {"level": "IC1", "level_title": "Associate", "steps": [85000, 87550]},
  {"level": "IC2", "level_title": "Intermediate", "steps": [100000, 103000, 106090]},
  {"level": "IC3", "level_title": "Mid-Level", "steps": [118000, 121540, 125186]},
  {"level": "IC4", "level_title": "Senior", "steps": [132000, 135960, 140039]},
  {"level": "IC5", "level_title": "Staff", "steps": [148000, 152440, 157013, 161723, 166575]}
]'::JSONB, NOW(), NOW()),

-- UX Researcher
('a0070000-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'UX Researcher', 'UX Researcher', 'Plans and conducts user research including interviews, usability testing, surveys, and contextual inquiry. Synthesizes findings into actionable insights that inform product and design decisions.', '15-1255', 'Web and Digital Interface Designers', '{"minimum": "Bachelor''s Degree"}'::JSONB, '4 years of experience', ARRAY[]::TEXT[], '[
  {"level": "IC1", "level_title": "Associate", "steps": [85000, 87550]},
  {"level": "IC2", "level_title": "Intermediate", "steps": [100000, 103000, 106090]},
  {"level": "IC3", "level_title": "Mid-Level", "steps": [118000, 121540, 125186]},
  {"level": "IC4", "level_title": "Senior", "steps": [132000, 135960, 140039]},
  {"level": "IC5", "level_title": "Staff", "steps": [148000, 152440, 157013, 161723, 166575]}
]'::JSONB, NOW(), NOW()),

-- Content/UX Writer
('a0080000-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'Content/UX Writer', 'Content Strategist / UX Writer', 'Creates clear, accessible content for digital products including UI microcopy, help documentation, plain language guidance, and content strategy. Ensures government communications meet plain language and accessibility standards.', '27-3043', 'Writers and Authors', '{"minimum": "Bachelor''s Degree"}'::JSONB, '4 years of experience', ARRAY[]::TEXT[], '[
  {"level": "IC1", "level_title": "Associate", "steps": [69000, 71070]},
  {"level": "IC2", "level_title": "Intermediate", "steps": [81000, 83430, 85933]},
  {"level": "IC3", "level_title": "Mid-Level", "steps": [95000, 97850, 100786]},
  {"level": "IC4", "level_title": "Senior", "steps": [110000, 113300, 116699]},
  {"level": "IC5", "level_title": "Staff", "steps": [130000, 133900, 137917, 142055, 146317]}
]'::JSONB, NOW(), NOW()),

-- Delivery Manager
('a0090000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'Delivery Manager', 'Delivery Manager', 'Manages delivery processes, sprint ceremonies, client relationships, reporting, and risk management. Ensures team health, removes blockers, and drives consistent delivery velocity.', '15-1299', 'Computer Occupations, All Other', '{"minimum": "Bachelor''s Degree"}'::JSONB, '6 years of experience', ARRAY['Certified ScrumMaster (CSM)', 'SAFe Agilist'], '[
  {"level": "IC1", "level_title": "Associate", "steps": [90000, 92700]},
  {"level": "IC2", "level_title": "Intermediate", "steps": [106000, 109180, 112455]},
  {"level": "IC3", "level_title": "Mid-Level", "steps": [125000, 128750, 132613]},
  {"level": "IC4", "level_title": "Senior", "steps": [140000, 144200, 148526]},
  {"level": "IC5", "level_title": "Staff", "steps": [158000, 162740, 167622, 172651, 177831]}
]'::JSONB, NOW(), NOW()),

-- Technical Lead
('a0100000-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'Technical Lead', 'Software Developer', 'Provides technical architecture direction, code review, and engineering mentorship. Owns technical decisions, ensures code quality, and bridges engineering with product and design.', '15-1252', 'Software Developers', '{"minimum": "Bachelor''s Degree"}'::JSONB, '8 years of experience', ARRAY[]::TEXT[], '[
  {"level": "IC3", "level_title": "Mid-Level", "steps": [145000, 149350]},
  {"level": "IC4", "level_title": "Senior", "steps": [165000, 169950, 175049]},
  {"level": "IC5", "level_title": "Staff", "steps": [185000, 190550, 196267, 202155, 208219]}
]'::JSONB, NOW(), NOW()),

-- Design Lead
('a0110000-0000-0000-0000-000000000011', '22222222-2222-2222-2222-222222222222', 'Design Lead', 'UX/UI Designer', 'Provides design direction, design system consistency, and mentorship. Owns design decisions, ensures accessibility and usability standards, and bridges design with product and engineering.', '15-1255', 'Web and Digital Interface Designers', '{"minimum": "Bachelor''s Degree"}'::JSONB, '8 years of experience', ARRAY[]::TEXT[], '[
  {"level": "IC3", "level_title": "Mid-Level", "steps": [138000, 142140]},
  {"level": "IC4", "level_title": "Senior", "steps": [155000, 159650, 164440]},
  {"level": "IC5", "level_title": "Staff", "steps": [175000, 180250, 185658, 191227, 196964]}
]'::JSONB, NOW(), NOW())

ON CONFLICT (id) DO UPDATE SET
  salary_levels = EXCLUDED.salary_levels,
  updated_at = NOW();

-- =============================================================================
-- 6. GSA RATES (28 ceiling rates - Contract 47QTCA23D0076)
-- =============================================================================

INSERT INTO gsa_rates (id, company_id, labor_category, sin, schedule_name, year_1_rate, year_2_rate, year_3_rate, year_4_rate, year_5_rate, years_experience, education, education_substitution, created_at, updated_at) VALUES
-- SIN 54151S — IT Professional Services (9 rates)
('b0010000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Product/Program Manager', '54151S', 'GSA MAS', 151.47, 159.35, 167.63, 176.34, 185.51, 2, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0020000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Project Manager', '54151S', 'GSA MAS', 167.51, 176.22, 185.38, 195.02, 205.17, 2, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0030000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Subject Matter Expert', '54151S', 'GSA MAS', 167.51, 176.22, 185.38, 195.02, 205.17, 3, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0040000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Consultant', '54151S', 'GSA MAS', 167.51, 176.22, 185.38, 195.02, 205.17, 2, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0050000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Developer', '54151S', 'GSA MAS', 191.44, 201.39, 211.86, 222.87, 234.46, 2, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0060000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'UX/UI Designer', '54151S', 'GSA MAS', 129.22, 135.94, 143.01, 150.45, 158.27, 1, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0070000-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'IT Content Strategy', '54151S', 'GSA MAS', 114.86, 120.84, 127.12, 133.73, 140.69, 1, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0080000-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'IT Training', '54151S', 'GSA MAS', 143.58, 151.04, 158.90, 167.16, 175.86, 2, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0090000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'Digital Transformer', '54151S', 'GSA MAS', 143.58, 151.04, 158.90, 167.16, 175.86, 1, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),

-- SIN 541611 — Management Consulting (5 rates)
('b0100000-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'Project Manager', '541611', 'GSA MAS', 167.51, 176.22, 185.99, 195.02, 205.17, 3, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0110000-0000-0000-0000-000000000011', '22222222-2222-2222-2222-222222222222', 'Subject Matter Expert', '541611', 'GSA MAS', 191.44, 201.39, 211.86, 222.87, 234.46, 1, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0120000-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'Consultant', '541611', 'GSA MAS', 167.51, 176.22, 185.99, 195.02, 205.17, 1, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0130000-0000-0000-0000-000000000013', '22222222-2222-2222-2222-222222222222', 'Associate', '541611', 'GSA MAS', 143.58, 151.04, 158.90, 167.16, 175.86, 3, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0140000-0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', 'Manager', '541611', 'GSA MAS', 167.51, 176.22, 185.99, 195.02, 205.17, 2, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),

-- SIN 541910 — Marketing Research & Analysis (2 rates)
('b0150000-0000-0000-0000-000000000015', '22222222-2222-2222-2222-222222222222', 'Subject Matter Expert I', '541910', 'GSA MAS', 143.58, 151.04, 158.90, 167.16, 175.86, 1, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),
('b0160000-0000-0000-0000-000000000016', '22222222-2222-2222-2222-222222222222', 'Subject Matter Expert II', '541910', 'GSA MAS', 191.44, 201.39, 211.86, 222.87, 234.46, 4, 'Bachelor''s', 'Associates Degree Equal to Two Years of Relevant Experience', NOW(), NOW()),

-- SIN 518210C — Cloud Computing (12 rates, Y4 and Y5 only)
('b0170000-0000-0000-0000-000000000017', '22222222-2222-2222-2222-222222222222', 'Cloud Senior Product Manager', '518210C', 'GSA MAS', NULL, NULL, NULL, 165.52, 174.13, 6, 'Bachelor''s', 'Eight Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0180000-0000-0000-0000-000000000018', '22222222-2222-2222-2222-222222222222', 'Cloud Digital Transformer', '518210C', 'GSA MAS', NULL, NULL, NULL, 156.90, 165.06, 6, 'Bachelor''s', 'Eight Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0190000-0000-0000-0000-000000000019', '22222222-2222-2222-2222-222222222222', 'Cloud AI/ML Engineer', '518210C', 'GSA MAS', NULL, NULL, NULL, 148.11, 155.81, 6, 'Bachelor''s', 'Eight Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0200000-0000-0000-0000-000000000020', '22222222-2222-2222-2222-222222222222', 'Cloud Solutions Architect', '518210C', 'GSA MAS', NULL, NULL, NULL, 172.80, 181.78, 8, 'Bachelor''s', 'Ten Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0210000-0000-0000-0000-000000000021', '22222222-2222-2222-2222-222222222222', 'Cloud Engineer', '518210C', 'GSA MAS', NULL, NULL, NULL, 139.04, 146.28, 6, 'Bachelor''s', 'Eight Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0220000-0000-0000-0000-000000000022', '22222222-2222-2222-2222-222222222222', 'Cloud DevSecOps Engineer', '518210C', 'GSA MAS', NULL, NULL, NULL, 143.68, 151.15, 6, 'Bachelor''s', 'Eight Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0230000-0000-0000-0000-000000000023', '22222222-2222-2222-2222-222222222222', 'Cloud Data Engineer', '518210C', 'GSA MAS', NULL, NULL, NULL, 133.30, 140.23, 4, 'Bachelor''s', 'Six Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0240000-0000-0000-0000-000000000024', '22222222-2222-2222-2222-222222222222', 'Cloud Software Developer', '518210C', 'GSA MAS', NULL, NULL, NULL, 123.43, 129.84, 3, 'Bachelor''s', 'Five Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0250000-0000-0000-0000-000000000025', '22222222-2222-2222-2222-222222222222', 'Cloud Consultant I', '518210C', 'GSA MAS', NULL, NULL, NULL, 98.74, 103.88, 2, 'Bachelor''s', 'Four Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0260000-0000-0000-0000-000000000026', '22222222-2222-2222-2222-222222222222', 'Cloud Consultant II', '518210C', 'GSA MAS', NULL, NULL, NULL, 148.11, 155.81, 6, 'Bachelor''s', 'Eight Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0270000-0000-0000-0000-000000000027', '22222222-2222-2222-2222-222222222222', 'Cloud Subject Matter Expert', '518210C', 'GSA MAS', NULL, NULL, NULL, 222.17, 233.72, 10, 'Bachelor''s', 'Twelve Years of Professional Services Relevant Experience', NOW(), NOW()),
('b0280000-0000-0000-0000-000000000028', '22222222-2222-2222-2222-222222222222', 'Cloud Task Manager', '518210C', 'GSA MAS', NULL, NULL, NULL, 139.04, 146.28, 6, 'Bachelor''s', 'Eight Years of Professional Services Relevant Experience', NOW(), NOW())

ON CONFLICT (id) DO UPDATE SET
  year_1_rate = EXCLUDED.year_1_rate,
  year_2_rate = EXCLUDED.year_2_rate,
  year_3_rate = EXCLUDED.year_3_rate,
  year_4_rate = EXCLUDED.year_4_rate,
  year_5_rate = EXCLUDED.year_5_rate,
  updated_at = NOW();

-- =============================================================================
-- 7. SAMPLE PROPOSAL with working_data for Roles & Pricing tab
-- =============================================================================

INSERT INTO proposals (
  id,
  company_id,
  title,
  solicitation_number,
  client,
  agency,
  status,
  contract_type,
  due_date,
  estimated_value,
  period_of_performance,
  team_size,
  progress,
  starred,
  archived,
  working_data,
  row_version,
  created_at,
  updated_at
) VALUES (
  '66666666-6666-6666-6666-666666666666',
  '22222222-2222-2222-2222-222222222222',
  'Sample Web Modernization Task Order',
  'SAMPLE-2026-001',
  'Department of Health and Human Services',
  'HHS',
  'in_progress',
  'tm',
  CURRENT_DATE + INTERVAL '30 days',
  1500000,
  '{"baseYear": true, "optionYears": 4}'::JSONB,
  8,
  45,
  true,
  false,
  '{
    "proposalSetup": {
      "contractType": "tm",
      "optionYears": 4,
      "setAside": "8(a) Sole Source",
      "billableHoursPerYear": 1920,
      "escalationRate": 0.03,
      "profitMargin": 8,
      "wordsPerPage": 500
    },
    "selectedRoles": [
      {
        "id": "a0010000-0000-0000-0000-000000000001",
        "title": "Back-end Developer",
        "level": "IC3",
        "step": 0,
        "salary": 120000,
        "quantity": 2,
        "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }
      },
      {
        "id": "a0020000-0000-0000-0000-000000000002",
        "title": "Front-end Developer",
        "level": "IC3",
        "step": 1,
        "salary": 131840,
        "quantity": 2,
        "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }
      },
      {
        "id": "a0060000-0000-0000-0000-000000000006",
        "title": "Product Designer",
        "level": "IC3",
        "step": 0,
        "salary": 118000,
        "quantity": 1,
        "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }
      },
      {
        "id": "a0050000-0000-0000-0000-000000000005",
        "title": "Product Manager",
        "level": "IC4",
        "step": 0,
        "salary": 140000,
        "quantity": 1,
        "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }
      },
      {
        "id": "a0090000-0000-0000-0000-000000000009",
        "title": "Delivery Manager",
        "level": "IC3",
        "step": 1,
        "salary": 128750,
        "quantity": 1,
        "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }
      },
      {
        "id": "a0100000-0000-0000-0000-000000000010",
        "title": "Technical Lead",
        "level": "IC4",
        "step": 0,
        "salary": 165000,
        "quantity": 1,
        "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }
      }
    ],
    "wbsElements": [
      {
        "id": "wbs-sample-001",
        "wbsNumber": "1.1",
        "title": "Project Management",
        "description": "Agile delivery management including sprint planning, retrospectives, and stakeholder reporting",
        "laborEstimates": [
          { "id": "le-001", "roleId": "a0090000-0000-0000-0000-000000000009", "roleName": "Delivery Manager", "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }, "rationale": "Full-time delivery management", "confidence": "high" }
        ],
        "status": "approved",
        "totalHours": 9600
      },
      {
        "id": "wbs-sample-002",
        "wbsNumber": "1.2",
        "title": "Product Strategy",
        "description": "Product roadmap development, user story grooming, and feature prioritization",
        "laborEstimates": [
          { "id": "le-002", "roleId": "a0050000-0000-0000-0000-000000000005", "roleName": "Product Manager", "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }, "rationale": "Full-time product ownership", "confidence": "high" }
        ],
        "status": "approved",
        "totalHours": 9600
      },
      {
        "id": "wbs-sample-003",
        "wbsNumber": "1.3",
        "title": "Application Development",
        "description": "Design, development, and deployment of web application modernization",
        "laborEstimates": [
          { "id": "le-003", "roleId": "a0100000-0000-0000-0000-000000000010", "roleName": "Technical Lead", "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }, "rationale": "Architecture and code review", "confidence": "high" },
          { "id": "le-004", "roleId": "a0010000-0000-0000-0000-000000000001", "roleName": "Back-end Developer", "hoursByPeriod": { "base": 3840, "option1": 3840, "option2": 3840, "option3": 3840, "option4": 3840 }, "rationale": "2 FTE API development", "confidence": "high" },
          { "id": "le-005", "roleId": "a0020000-0000-0000-0000-000000000002", "roleName": "Front-end Developer", "hoursByPeriod": { "base": 3840, "option1": 3840, "option2": 3840, "option3": 3840, "option4": 3840 }, "rationale": "2 FTE UI development", "confidence": "high" }
        ],
        "status": "approved",
        "totalHours": 48000
      },
      {
        "id": "wbs-sample-004",
        "wbsNumber": "1.4",
        "title": "User Experience Design",
        "description": "User research, wireframing, and interface design",
        "laborEstimates": [
          { "id": "le-006", "roleId": "a0060000-0000-0000-0000-000000000006", "roleName": "Product Designer", "hoursByPeriod": { "base": 1920, "option1": 1920, "option2": 1920, "option3": 1920, "option4": 1920 }, "rationale": "Full-time UX/UI design", "confidence": "high" }
        ],
        "status": "approved",
        "totalHours": 9600
      }
    ],
    "solicitation": {
      "title": "Sample Web Modernization Task Order",
      "solicitationNumber": "SAMPLE-2026-001",
      "clientAgency": "Department of Health and Human Services",
      "contractType": "T&M",
      "periodOfPerformance": { "baseYear": true, "optionYears": 4 },
      "setAside": "8(a) Sole Source",
      "requiresClearance": false,
      "placeOfPerformance": { "type": "remote", "locations": [], "travelRequired": false }
    }
  }'::JSONB,
  1,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  working_data = EXCLUDED.working_data,
  updated_at = NOW();

-- =============================================================================
-- VERIFICATION QUERIES (run manually to confirm seed worked)
-- =============================================================================
-- SELECT COUNT(*) as roles FROM company_roles WHERE company_id = '22222222-2222-2222-2222-222222222222';
-- SELECT COUNT(*) as gsa_rates FROM gsa_rates WHERE company_id = '22222222-2222-2222-2222-222222222222';
-- SELECT fringe_rate, overhead_rate, ga_rate, profit_targets FROM company_settings WHERE company_id = '22222222-2222-2222-2222-222222222222';
-- SELECT title, contract_type, working_data->'selectedRoles' IS NOT NULL as has_roles FROM proposals WHERE id = '66666666-6666-6666-6666-666666666666';
