


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."increment_row_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.row_version := COALESCE(OLD.row_version, 0) + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_row_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tenant_admin"("check_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = check_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_tenant_admin"("check_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_tenant_admin"("check_tenant_id" "uuid") IS 'Check if current user is owner/admin of the given tenant. SECURITY DEFINER with hardened search_path.';



CREATE OR REPLACE FUNCTION "public"."update_proposal_sections_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_proposal_sections_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$                                                                                                                                                  
  BEGIN                                                                                                                                                                  
    NEW.updated_at = NOW();                                                                                                                                              
    RETURN NEW;                                                                                                                                                          
  END;                                                                                                                                                                   
  $$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "actor_type" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "command_name" "text" NOT NULL,
    "aggregate_type" "text" NOT NULL,
    "aggregate_id" "uuid" NOT NULL,
    "before_version" integer,
    "after_version" integer NOT NULL,
    "changed_fields" "jsonb",
    "command_input" "jsonb",
    "correlation_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "audit_events_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['user'::"text", 'system'::"text", 'ai_job'::"text"])))
);


ALTER TABLE "public"."audit_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_events" IS 'Immutable audit log of all command executions';



COMMENT ON COLUMN "public"."audit_events"."actor_type" IS 'user=authenticated user, system=background job, ai_job=AI processing';



COMMENT ON COLUMN "public"."audit_events"."before_version" IS 'NULL for create operations';



COMMENT ON COLUMN "public"."audit_events"."changed_fields" IS 'JSON object with field names as keys, {old, new} as values';



COMMENT ON COLUMN "public"."audit_events"."correlation_id" IS 'Links related events across multiple commands in a logical operation';



CREATE TABLE IF NOT EXISTS "public"."boe_share_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone,
    "view_count" integer DEFAULT 0 NOT NULL,
    "last_viewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "link_type" "text" DEFAULT 'accountant'::"text",
    "label" "text",
    "reviewer_email" "text",
    "approval_status" "text" DEFAULT 'pending'::"text",
    "accountant_note" "text",
    "approved_at" timestamp with time zone,
    CONSTRAINT "valid_link_type" CHECK (("link_type" = ANY (ARRAY['accountant'::"text", 'boe'::"text"])))
);


ALTER TABLE "public"."boe_share_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collab_section_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "proposal_id" "uuid",
    "company_id" "uuid",
    "link_type" "text" NOT NULL,
    "label" "text",
    "reviewer_email" "text",
    "reviewer_name" "text",
    "section_ids" "text"[] NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone,
    "submission_status" "text" DEFAULT 'pending'::"text",
    "submitted_at" timestamp with time zone,
    "submission_content" "jsonb",
    "transformed_content" "jsonb",
    "reviewer_note" "text",
    "approved_at" timestamp with time zone,
    CONSTRAINT "collab_section_links_link_type_check" CHECK (("link_type" = ANY (ARRAY['contributor'::"text", 'subcontractor'::"text"]))),
    CONSTRAINT "collab_section_links_submission_status_check" CHECK (("submission_status" = ANY (ARRAY['pending'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text", 'transform_pending'::"text", 'transform_approved'::"text"])))
);


ALTER TABLE "public"."collab_section_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collab_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "reviewer_name" "text" NOT NULL,
    "reviewer_title" "text",
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "assigned_wbs_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "completed_at" timestamp with time zone,
    CONSTRAINT "collab_sessions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."collab_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "legal_name" "text",
    "sam_uei" "text",
    "cage_code" "text",
    "duns_number" "text",
    "ein" "text",
    "naics_codes" "text"[],
    "street_address" "text",
    "city" "text",
    "state" "text",
    "zip_code" "text",
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "address" "jsonb" DEFAULT '{}'::"jsonb",
    "gsa_contract_number" "text",
    "gsa_mas_schedule" boolean DEFAULT false,
    "idiq_contracts" "jsonb" DEFAULT '[]'::"jsonb",
    "duns" "text",
    "gsa_config" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."companies"."gsa_config" IS 'GSA Schedule configuration: {
  gsaMasSchedule: boolean,
  gsaContractNumber: string,
  gsaEscalationRate: number,
  gsaBaseYear: number,
  gsaSins: [{ id, sin, title, laborCategories: [{ id, laborCategory, hourlyRate, ... }] }]
}';



CREATE TABLE IF NOT EXISTS "public"."company_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "title" "text" NOT NULL,
    "labor_category" "text",
    "soc_code" "text",
    "education" "jsonb",
    "certifications" "text"[],
    "min_years_experience" integer,
    "base_salary" numeric(10,2),
    "level_salaries" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "functional_responsibilities" "text",
    "soc_title" "text",
    "gsa_labor_category" "text",
    "gsa_sin" "text",
    "sca_code" "text",
    "sca_occupation" "text",
    "category" "text",
    "notes" "text",
    "salary_levels" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."company_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "fringe_rate" numeric(5,4) DEFAULT 0.35,
    "overhead_rate" numeric(5,4) DEFAULT 0.15,
    "ga_rate" numeric(5,4) DEFAULT 0.08,
    "profit_rate" numeric(5,4) DEFAULT 0.10,
    "escalation_rate" numeric(5,4) DEFAULT 0.03,
    "gsa_contract_number" "text",
    "gsa_expiration_date" "date",
    "gsa_sins" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "writing_guide" "jsonb" DEFAULT '{}'::"jsonb",
    "content_library" "jsonb" DEFAULT '{}'::"jsonb",
    "profit_targets" "jsonb" DEFAULT '{"tm": 0.08, "ffp": 0.10, "gsa": 0.08, "cpff": 0.08, "cpif": 0.10, "hybrid": 0.10}'::"jsonb"
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_settings"."writing_guide" IS 'FFTC Writing Guide configuration: {
  voice_description: string,
  reading_level: string,
  sentence_rules: string[],
  words_to_avoid: string[],
  words_to_use: string[],
  structural_rules: string[],
  example_sentences: string[]
}';



COMMENT ON COLUMN "public"."company_settings"."content_library" IS 'Content library for proposals: {
  pastPerformance: [...],
  standardApproaches: [...]
}';



COMMENT ON COLUMN "public"."company_settings"."profit_targets" IS 'Profit margin targets by contract type (decimal). FFP default is 10% (Low risk). Medium (12%) and High (15%) require explicit selection.';



CREATE TABLE IF NOT EXISTS "public"."compliance_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "requirement_id" "uuid",
    "requirement_text" "text" NOT NULL,
    "requirement_ref" "text" NOT NULL,
    "proposal_section" "text" NOT NULL,
    "compliance_status" "text" NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "owner" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'requirement'::"text",
    "linked_wbs_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    CONSTRAINT "compliance_items_compliance_status_check" CHECK (("compliance_status" = ANY (ARRAY['compliant'::"text", 'partial'::"text", 'exception'::"text", 'na'::"text", 'unaddressed'::"text"]))),
    CONSTRAINT "compliance_items_source_check" CHECK (("source" = ANY (ARRAY['requirement'::"text", 'instruction'::"text"])))
);


ALTER TABLE "public"."compliance_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_library" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "last_used_at" timestamp with time zone,
    "use_count" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_library_type_check" CHECK (("type" = ANY (ARRAY['past_performance'::"text", 'key_personnel'::"text", 'capability_statement'::"text", 'standard_approach'::"text", 'win_theme'::"text"])))
);


ALTER TABLE "public"."content_library" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gsa_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "labor_category" "text" NOT NULL,
    "sin" "text" NOT NULL,
    "schedule_name" "text" DEFAULT 'GSA MAS'::"text",
    "year_1_rate" numeric(10,2),
    "year_2_rate" numeric(10,2),
    "year_3_rate" numeric(10,2),
    "year_4_rate" numeric(10,2),
    "year_5_rate" numeric(10,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "years_experience" integer,
    "education" "text",
    "education_substitution" "text"
);


ALTER TABLE "public"."gsa_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "link" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['collab_submitted'::"text", 'boe_approved'::"text", 'boe_corrections'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "section_number" "text",
    "title" "text" NOT NULL,
    "summary" "text",
    "content" "text",
    "instructions" "text",
    "compliance_item_ids" "text"[] DEFAULT '{}'::"text"[],
    "requirement_refs" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "target_word_count" integer,
    "actual_word_count" integer DEFAULT 0,
    "owner" "text",
    "notes" "text",
    "ai_generated" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "content_text" "text",
    "last_edited_by" "text",
    "last_edited_at" timestamp with time zone,
    CONSTRAINT "proposal_sections_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_progress'::"text", 'review'::"text", 'complete'::"text", 'locked'::"text"])))
);


ALTER TABLE "public"."proposal_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "title" "text" NOT NULL,
    "solicitation_number" "text",
    "client_agency" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "contract_type" "text" DEFAULT 'tm'::"text",
    "due_date" "date",
    "estimated_value" numeric(12,2),
    "period_of_performance" "jsonb" DEFAULT '{"baseYear": true, "optionYears": 2}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_value" numeric(15,2),
    "team_size" integer,
    "progress" integer DEFAULT 0,
    "starred" boolean DEFAULT false,
    "archived" boolean DEFAULT false,
    "client" "text",
    "agency" "text",
    "working_data" "jsonb" DEFAULT '{}'::"jsonb",
    "strategy" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "row_version" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."proposals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."proposals"."working_data" IS 'Full proposal workspace state: solicitation, selectedRoles, subcontractors, teamingPartners, estimateWbsElements, rateJustifications, odcs, perDiem';



COMMENT ON COLUMN "public"."proposals"."row_version" IS 'Optimistic concurrency control: auto-increments on each update';



CREATE TABLE IF NOT EXISTS "public"."requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid",
    "reference_number" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'shall'::"text",
    "category" "text",
    "source" "text",
    "priority" "text" DEFAULT 'medium'::"text",
    "linked_wbs_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "linked_wbs_ids" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."section_coaching" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_id" "text" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "feedback" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "overall_assessment" "text",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "content_snapshot" "text"
);


ALTER TABLE "public"."section_coaching" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'estimator'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "invited_by" "uuid",
    CONSTRAINT "tenant_memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'estimator'::"text", 'writer'::"text", 'reviewer'::"text", 'accountant'::"text"]))),
    CONSTRAINT "tenant_memberships_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'invited'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."tenant_memberships" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_memberships" IS 'User-tenant relationships with role-based permissions';



COMMENT ON COLUMN "public"."tenant_memberships"."role" IS 'owner=full control, admin=manage users, estimator=pricing work, writer=proposal text, reviewer=approvals, accountant=rates';



CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tenants_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS 'Multi-tenancy root: each tenant is an organization with isolated data';



CREATE TABLE IF NOT EXISTS "public"."wbs_elements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid",
    "wbs_number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "sow_reference" "text",
    "why" "text",
    "what" "text",
    "not_included" "text",
    "assumptions" "text"[],
    "estimate_method" "text" DEFAULT 'engineering'::"text",
    "confidence" "text" DEFAULT 'medium'::"text",
    "labor_estimates" "jsonb" DEFAULT '[]'::"jsonb",
    "linked_requirement_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wbs_elements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wbs_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "wbs_element_id" "text",
    "is_new_element" boolean DEFAULT false,
    "proposed_title" "text",
    "proposed_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "proposed_roles" "jsonb" DEFAULT '[]'::"jsonb",
    "proposed_estimation_method" "text",
    "proposed_assumptions" "text",
    "proposed_notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewer_comment" "text",
    "owner_response" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wbs_submissions_proposed_estimation_method_check" CHECK (("proposed_estimation_method" = ANY (ARRAY['engineering'::"text", 'parametric'::"text", 'historical'::"text", NULL::"text"]))),
    CONSTRAINT "wbs_submissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'modified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."wbs_submissions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boe_share_links"
    ADD CONSTRAINT "boe_share_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boe_share_links"
    ADD CONSTRAINT "boe_share_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."collab_section_links"
    ADD CONSTRAINT "collab_section_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collab_section_links"
    ADD CONSTRAINT "collab_section_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."collab_sessions"
    ADD CONSTRAINT "collab_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collab_sessions"
    ADD CONSTRAINT "collab_sessions_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_roles"
    ADD CONSTRAINT "company_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_company_id_key" UNIQUE ("company_id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_items"
    ADD CONSTRAINT "compliance_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_library"
    ADD CONSTRAINT "content_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gsa_rates"
    ADD CONSTRAINT "gsa_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_sections"
    ADD CONSTRAINT "proposal_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requirements"
    ADD CONSTRAINT "requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."section_coaching"
    ADD CONSTRAINT "section_coaching_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."section_coaching"
    ADD CONSTRAINT "section_coaching_proposal_section_unique" UNIQUE ("proposal_id", "section_id");



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."wbs_elements"
    ADD CONSTRAINT "wbs_elements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wbs_submissions"
    ADD CONSTRAINT "wbs_submissions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_actor" ON "public"."audit_events" USING "btree" ("tenant_id", "actor_type", "actor_id", "created_at" DESC);



CREATE INDEX "idx_audit_aggregate" ON "public"."audit_events" USING "btree" ("aggregate_type", "aggregate_id", "created_at" DESC);



CREATE INDEX "idx_audit_command" ON "public"."audit_events" USING "btree" ("tenant_id", "command_name", "created_at" DESC);



CREATE INDEX "idx_audit_correlation" ON "public"."audit_events" USING "btree" ("correlation_id") WHERE ("correlation_id" IS NOT NULL);



CREATE INDEX "idx_audit_tenant" ON "public"."audit_events" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_boe_share_links_proposal_id" ON "public"."boe_share_links" USING "btree" ("proposal_id");



CREATE INDEX "idx_boe_share_links_token" ON "public"."boe_share_links" USING "btree" ("token");



CREATE INDEX "idx_coaching_section" ON "public"."section_coaching" USING "btree" ("section_id");



CREATE INDEX "idx_collab_section_links_proposal" ON "public"."collab_section_links" USING "btree" ("proposal_id");



CREATE INDEX "idx_collab_section_links_token" ON "public"."collab_section_links" USING "btree" ("token");



CREATE INDEX "idx_collab_sessions_proposal" ON "public"."collab_sessions" USING "btree" ("proposal_id");



CREATE INDEX "idx_collab_sessions_token" ON "public"."collab_sessions" USING "btree" ("token");



CREATE INDEX "idx_companies_owner" ON "public"."companies" USING "btree" ("owner_id");



CREATE INDEX "idx_company_roles_company" ON "public"."company_roles" USING "btree" ("company_id");



CREATE INDEX "idx_compliance_items_proposal_id" ON "public"."compliance_items" USING "btree" ("proposal_id");



CREATE INDEX "idx_content_library_company" ON "public"."content_library" USING "btree" ("company_id");



CREATE INDEX "idx_content_library_type" ON "public"."content_library" USING "btree" ("company_id", "type");



CREATE INDEX "idx_gsa_rates_company" ON "public"."gsa_rates" USING "btree" ("company_id");



CREATE INDEX "idx_memberships_role" ON "public"."tenant_memberships" USING "btree" ("tenant_id", "role");



CREATE INDEX "idx_memberships_tenant" ON "public"."tenant_memberships" USING "btree" ("tenant_id");



CREATE INDEX "idx_memberships_user" ON "public"."tenant_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_company" ON "public"."notifications" USING "btree" ("company_id", "read", "created_at" DESC);



CREATE INDEX "idx_proposal_sections_parent" ON "public"."proposal_sections" USING "btree" ("parent_id");



CREATE INDEX "idx_proposal_sections_proposal" ON "public"."proposal_sections" USING "btree" ("proposal_id");



CREATE INDEX "idx_proposal_sections_sort" ON "public"."proposal_sections" USING "btree" ("proposal_id", "parent_id", "sort_order");



CREATE INDEX "idx_proposals_company" ON "public"."proposals" USING "btree" ("company_id");



CREATE INDEX "idx_proposals_row_version" ON "public"."proposals" USING "btree" ("id", "row_version");



CREATE INDEX "idx_requirements_proposal" ON "public"."requirements" USING "btree" ("proposal_id");



CREATE INDEX "idx_tenants_company" ON "public"."tenants" USING "btree" ("company_id");



CREATE INDEX "idx_tenants_slug" ON "public"."tenants" USING "btree" ("slug");



CREATE INDEX "idx_tenants_status" ON "public"."tenants" USING "btree" ("status");



CREATE INDEX "idx_wbs_elements_proposal" ON "public"."wbs_elements" USING "btree" ("proposal_id");



CREATE INDEX "idx_wbs_submissions_session" ON "public"."wbs_submissions" USING "btree" ("session_id");



CREATE INDEX "idx_wbs_submissions_wbs" ON "public"."wbs_submissions" USING "btree" ("wbs_element_id");



CREATE OR REPLACE TRIGGER "proposals_row_version_trigger" BEFORE UPDATE ON "public"."proposals" FOR EACH ROW EXECUTE FUNCTION "public"."increment_row_version"();



CREATE OR REPLACE TRIGGER "trigger_proposal_sections_updated_at" BEFORE UPDATE ON "public"."proposal_sections" FOR EACH ROW EXECUTE FUNCTION "public"."update_proposal_sections_updated_at"();



CREATE OR REPLACE TRIGGER "update_compliance_items_updated_at" BEFORE UPDATE ON "public"."compliance_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."boe_share_links"
    ADD CONSTRAINT "boe_share_links_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collab_section_links"
    ADD CONSTRAINT "collab_section_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collab_section_links"
    ADD CONSTRAINT "collab_section_links_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collab_sessions"
    ADD CONSTRAINT "collab_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."collab_sessions"
    ADD CONSTRAINT "collab_sessions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."company_roles"
    ADD CONSTRAINT "company_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_items"
    ADD CONSTRAINT "compliance_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_items"
    ADD CONSTRAINT "compliance_items_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_library"
    ADD CONSTRAINT "content_library_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_library"
    ADD CONSTRAINT "content_library_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."gsa_rates"
    ADD CONSTRAINT "gsa_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_sections"
    ADD CONSTRAINT "proposal_sections_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."proposal_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_sections"
    ADD CONSTRAINT "proposal_sections_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requirements"
    ADD CONSTRAINT "requirements_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."section_coaching"
    ADD CONSTRAINT "section_coaching_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."wbs_elements"
    ADD CONSTRAINT "wbs_elements_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wbs_submissions"
    ADD CONSTRAINT "wbs_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."wbs_submissions"
    ADD CONSTRAINT "wbs_submissions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."collab_sessions"("id") ON DELETE CASCADE;



CREATE POLICY "Admin manage memberships" ON "public"."tenant_memberships" TO "authenticated" USING ("public"."is_tenant_admin"("tenant_id")) WITH CHECK ("public"."is_tenant_admin"("tenant_id"));



CREATE POLICY "Admin view all tenant memberships" ON "public"."tenant_memberships" FOR SELECT TO "authenticated" USING ("public"."is_tenant_admin"("tenant_id"));



CREATE POLICY "Authenticated users can manage compliance items" ON "public"."compliance_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Company manages collab links" ON "public"."collab_section_links" TO "authenticated" USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Company members manage content" ON "public"."content_library" USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Company reads own notifications" ON "public"."notifications" TO "authenticated" USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Members view own tenant" ON "public"."tenants" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "tenant_memberships"."tenant_id"
   FROM "public"."tenant_memberships"
  WHERE (("tenant_memberships"."user_id" = "auth"."uid"()) AND ("tenant_memberships"."status" = 'active'::"text")))));



CREATE POLICY "Owner manages GSA rates" ON "public"."gsa_rates" USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owner manages coaching" ON "public"."section_coaching" TO "authenticated" USING (("proposal_id" IN ( SELECT "p"."id"
   FROM ("public"."proposals" "p"
     JOIN "public"."companies" "c" ON (("p"."company_id" = "c"."id")))
  WHERE ("c"."owner_id" = "auth"."uid"())))) WITH CHECK (("proposal_id" IN ( SELECT "p"."id"
   FROM ("public"."proposals" "p"
     JOIN "public"."companies" "c" ON (("p"."company_id" = "c"."id")))
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owner manages collab sessions" ON "public"."collab_sessions" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Owner manages submissions" ON "public"."wbs_submissions" USING (("session_id" IN ( SELECT "collab_sessions"."id"
   FROM "public"."collab_sessions"
  WHERE ("collab_sessions"."created_by" = "auth"."uid"()))));



CREATE POLICY "Owner/admin read audit events" ON "public"."audit_events" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tenant_memberships"."tenant_id"
   FROM "public"."tenant_memberships"
  WHERE (("tenant_memberships"."user_id" = "auth"."uid"()) AND ("tenant_memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("tenant_memberships"."status" = 'active'::"text")))));



CREATE POLICY "Owner/admin update tenant" ON "public"."tenants" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "tenant_memberships"."tenant_id"
   FROM "public"."tenant_memberships"
  WHERE (("tenant_memberships"."user_id" = "auth"."uid"()) AND ("tenant_memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("tenant_memberships"."status" = 'active'::"text"))))) WITH CHECK (("id" IN ( SELECT "tenant_memberships"."tenant_id"
   FROM "public"."tenant_memberships"
  WHERE (("tenant_memberships"."user_id" = "auth"."uid"()) AND ("tenant_memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("tenant_memberships"."status" = 'active'::"text")))));



CREATE POLICY "System insert audit events" ON "public"."audit_events" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" IN ( SELECT "tenant_memberships"."tenant_id"
   FROM "public"."tenant_memberships"
  WHERE (("tenant_memberships"."user_id" = "auth"."uid"()) AND ("tenant_memberships"."status" = 'active'::"text")))));



CREATE POLICY "Users can create own company" ON "public"."companies" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can create own company roles" ON "public"."company_roles" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can create own company settings" ON "public"."company_settings" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can create own proposals" ON "public"."proposals" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can create own requirements" ON "public"."requirements" FOR INSERT WITH CHECK (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create own wbs elements" ON "public"."wbs_elements" FOR INSERT WITH CHECK (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own company" ON "public"."companies" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own company roles" ON "public"."company_roles" FOR DELETE USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own proposals" ON "public"."proposals" FOR DELETE USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own requirements" ON "public"."requirements" FOR DELETE USING (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own wbs elements" ON "public"."wbs_elements" FOR DELETE USING (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own company" ON "public"."companies" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own company roles" ON "public"."company_roles" USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage own company settings" ON "public"."company_settings" USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage own proposals" ON "public"."proposals" USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage own requirements" ON "public"."requirements" USING (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage own wbs elements" ON "public"."wbs_elements" USING (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage their own proposal share links" ON "public"."boe_share_links" USING ((EXISTS ( SELECT 1
   FROM ("public"."proposals" "p"
     JOIN "public"."companies" "c" ON (("p"."company_id" = "c"."id")))
  WHERE (("p"."id" = "boe_share_links"."proposal_id") AND ("c"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own company" ON "public"."companies" FOR UPDATE USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can update own company roles" ON "public"."company_roles" FOR UPDATE USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own company settings" ON "public"."company_settings" FOR UPDATE USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own proposals" ON "public"."proposals" FOR UPDATE USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own requirements" ON "public"."requirements" FOR UPDATE USING (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"())))))) WITH CHECK (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own wbs elements" ON "public"."wbs_elements" FOR UPDATE USING (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"())))))) WITH CHECK (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own company" ON "public"."companies" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can view own company roles" ON "public"."company_roles" FOR SELECT USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own company settings" ON "public"."company_settings" FOR SELECT USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own proposals" ON "public"."proposals" FOR SELECT USING (("company_id" IN ( SELECT "companies"."id"
   FROM "public"."companies"
  WHERE ("companies"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own requirements" ON "public"."requirements" FOR SELECT USING (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own wbs elements" ON "public"."wbs_elements" FOR SELECT USING (("proposal_id" IN ( SELECT "proposals"."id"
   FROM "public"."proposals"
  WHERE ("proposals"."company_id" IN ( SELECT "companies"."id"
           FROM "public"."companies"
          WHERE ("companies"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users manage their proposal sections" ON "public"."proposal_sections" USING (("proposal_id" IN ( SELECT "p"."id"
   FROM ("public"."proposals" "p"
     JOIN "public"."companies" "c" ON (("p"."company_id" = "c"."id")))
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users view own membership" ON "public"."tenant_memberships" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."audit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."boe_share_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collab_section_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collab_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_library" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gsa_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proposal_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."section_coaching" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wbs_elements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wbs_submissions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."increment_row_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_row_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_row_version"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_tenant_admin"("check_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_tenant_admin"("check_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tenant_admin"("check_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_proposal_sections_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_proposal_sections_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_proposal_sections_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_events" TO "anon";
GRANT ALL ON TABLE "public"."audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."boe_share_links" TO "anon";
GRANT ALL ON TABLE "public"."boe_share_links" TO "authenticated";
GRANT ALL ON TABLE "public"."boe_share_links" TO "service_role";



GRANT ALL ON TABLE "public"."collab_section_links" TO "anon";
GRANT ALL ON TABLE "public"."collab_section_links" TO "authenticated";
GRANT ALL ON TABLE "public"."collab_section_links" TO "service_role";



GRANT ALL ON TABLE "public"."collab_sessions" TO "anon";
GRANT ALL ON TABLE "public"."collab_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."collab_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_roles" TO "anon";
GRANT ALL ON TABLE "public"."company_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."company_roles" TO "service_role";



GRANT ALL ON TABLE "public"."company_settings" TO "anon";
GRANT ALL ON TABLE "public"."company_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."company_settings" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_items" TO "anon";
GRANT ALL ON TABLE "public"."compliance_items" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_items" TO "service_role";



GRANT ALL ON TABLE "public"."content_library" TO "anon";
GRANT ALL ON TABLE "public"."content_library" TO "authenticated";
GRANT ALL ON TABLE "public"."content_library" TO "service_role";



GRANT ALL ON TABLE "public"."gsa_rates" TO "anon";
GRANT ALL ON TABLE "public"."gsa_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."gsa_rates" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_sections" TO "anon";
GRANT ALL ON TABLE "public"."proposal_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_sections" TO "service_role";



GRANT ALL ON TABLE "public"."proposals" TO "anon";
GRANT ALL ON TABLE "public"."proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."proposals" TO "service_role";



GRANT ALL ON TABLE "public"."requirements" TO "anon";
GRANT ALL ON TABLE "public"."requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."requirements" TO "service_role";



GRANT ALL ON TABLE "public"."section_coaching" TO "anon";
GRANT ALL ON TABLE "public"."section_coaching" TO "authenticated";
GRANT ALL ON TABLE "public"."section_coaching" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_memberships" TO "anon";
GRANT ALL ON TABLE "public"."tenant_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."wbs_elements" TO "anon";
GRANT ALL ON TABLE "public"."wbs_elements" TO "authenticated";
GRANT ALL ON TABLE "public"."wbs_elements" TO "service_role";



GRANT ALL ON TABLE "public"."wbs_submissions" TO "anon";
GRANT ALL ON TABLE "public"."wbs_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."wbs_submissions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































