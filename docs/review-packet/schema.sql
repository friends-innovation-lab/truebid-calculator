-- ============================================================================
-- TrueBid Production Schema Dump
-- Generated: 2026-07-12
-- Source: production (qtotsijebcpddipmzstb)
-- Commit: 18a69b409e9f6afe65e67bbe404ab8cca5d4e958
-- Command: pg_dump --schema-only --no-owner --no-acl (read-only)
-- ============================================================================
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: doc_type_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.doc_type_source AS ENUM (
    'ai_classified',
    'user_confirmed'
);


--
-- Name: document_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_status AS ENUM (
    'uploaded',
    'classified',
    'extracted',
    'failed'
);


--
-- Name: document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_type AS ENUM (
    'pws_sow',
    'instructions',
    'qa_amendment',
    'pricing_template',
    'other'
);


--
-- Name: intelligence_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.intelligence_status AS ENUM (
    'draft',
    'confirmed',
    'superseded'
);


--
-- Name: labor_category_match; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.labor_category_match AS (
	category_id uuid,
	match_type text,
	confidence numeric(3,2)
);


--
-- Name: TYPE labor_category_match; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.labor_category_match IS 'Result of role title resolution: category_id, match_type, confidence';


--
-- Name: prime_or_sub; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prime_or_sub AS ENUM (
    'prime',
    'sub'
);


--
-- Name: rate_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rate_source_type AS ENUM (
    'catalog',
    'manual',
    'gsa_schedule',
    'subcontractor'
);


--
-- Name: TYPE rate_source_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.rate_source_type IS 'Source of pricing data: catalog, manual, gsa_schedule, or subcontractor';


--
-- Name: staffing_model; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.staffing_model AS ENUM (
    'prescribed',
    'offeror_proposed',
    'unclear'
);


--
-- Name: staffing_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.staffing_source AS ENUM (
    'generated',
    'user_added'
);


--
-- Name: wbs_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wbs_status AS ENUM (
    'generated_candidate',
    'draft',
    'active',
    'superseded'
);


--
-- Name: wbs_task_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wbs_task_source AS ENUM (
    'generated',
    'user_added'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in',
    'like',
    'ilike',
    'is',
    'match',
    'imatch',
    'isdistinct'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text,
	negate boolean
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: -
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: check_active_intelligence_version_ownership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_active_intelligence_version_ownership() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  version_proposal_id UUID;
BEGIN
  IF NEW.active_intelligence_version_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT proposal_id INTO version_proposal_id
  FROM intelligence_versions
  WHERE id = NEW.active_intelligence_version_id;

  IF version_proposal_id IS NULL THEN
    -- Let FK constraint handle missing version
    RETURN NEW;
  END IF;

  IF version_proposal_id != NEW.id THEN
    RAISE EXCEPTION 'active_intelligence_version_id must reference a version belonging to this proposal (proposal: %, version proposal: %)',
      NEW.id, version_proposal_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: check_fact_table_parent_draft(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_fact_table_parent_draft() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  parent_status intelligence_status;
BEGIN
  -- Get parent version status
  SELECT status INTO parent_status
  FROM intelligence_versions
  WHERE id = COALESCE(NEW.version_id, OLD.version_id);

  IF parent_status IS NULL THEN
    -- Parent doesn't exist, let FK constraint handle it
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only allow modifications when parent is draft
  IF parent_status != 'draft' THEN
    RAISE EXCEPTION 'Cannot modify fact table when parent intelligence version is % (version_id: %)',
      parent_status, COALESCE(NEW.version_id, OLD.version_id)
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- For DELETE, return OLD; for INSERT/UPDATE, return NEW
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION check_fact_table_parent_draft(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_fact_table_parent_draft() IS 'Ensures fact tables can only be modified when parent version is draft';


--
-- Name: check_intelligence_version_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_intelligence_version_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status IN ('confirmed', 'superseded') THEN
    RAISE EXCEPTION 'Cannot delete % intelligence version (id: %)', OLD.status, OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: check_intelligence_version_immutability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_intelligence_version_immutability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Allow transition from confirmed to superseded
  IF OLD.status = 'confirmed' AND NEW.status = 'superseded' THEN
    -- Only superseded_at should change
    IF NEW.confirmation_hash IS DISTINCT FROM OLD.confirmation_hash
       OR NEW.facts_json IS DISTINCT FROM OLD.facts_json
       OR NEW.contract_type IS DISTINCT FROM OLD.contract_type
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    THEN
      RAISE EXCEPTION 'Cannot modify confirmed intelligence version fields during supersede transition'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Block all other mutations on confirmed versions
  IF OLD.status = 'confirmed' THEN
    RAISE EXCEPTION 'Cannot modify confirmed intelligence version (id: %)', OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Block all mutations on superseded versions
  IF OLD.status = 'superseded' THEN
    RAISE EXCEPTION 'Cannot modify superseded intelligence version (id: %)', OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Allow mutations on draft versions
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION check_intelligence_version_immutability(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_intelligence_version_immutability() IS 'Enforces immutability on confirmed/superseded intelligence versions';


--
-- Name: compute_document_set_hash(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_document_set_hash(v_proposal_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT encode(
    sha256(
      string_agg(content_hash, '|' ORDER BY content_hash)::bytea
    ),
    'hex'
  )
  INTO v_hash
  FROM solicitation_documents
  WHERE proposal_id = v_proposal_id
    AND status = 'extracted'
    AND content_hash IS NOT NULL;

  RETURN v_hash;
END;
$$;


--
-- Name: FUNCTION compute_document_set_hash(v_proposal_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.compute_document_set_hash(v_proposal_id uuid) IS 'Computes SHA-256 of sorted content hashes from all extracted documents for a proposal';


--
-- Name: document_set_changed(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_set_changed(v_proposal_id uuid, v_current_hash text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_new_hash TEXT;
BEGIN
  v_new_hash := compute_document_set_hash(v_proposal_id);

  -- If no documents yet, no change (nothing to extract from)
  IF v_new_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If no current hash, documents exist so there's been a change
  IF v_current_hash IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN v_new_hash != v_current_hash;
END;
$$;


--
-- Name: FUNCTION document_set_changed(v_proposal_id uuid, v_current_hash text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.document_set_changed(v_proposal_id uuid, v_current_hash text) IS 'Returns true if the document set has changed since the given hash was computed';


--
-- Name: get_intelligence_version_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_intelligence_version_tenant(check_version_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT tenant_id FROM intelligence_versions WHERE id = check_version_id;
$$;


--
-- Name: get_labor_category_salary(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_labor_category_salary(v_category_id uuid, v_level_key text, v_step_index integer DEFAULT 0) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_levels JSONB;
  v_level JSONB;
  v_steps JSONB;
  v_salary INTEGER;
BEGIN
  -- Get the levels JSONB
  SELECT levels INTO v_levels
  FROM tenant_labor_categories
  WHERE id = v_category_id;

  IF v_levels IS NULL THEN
    RETURN NULL; -- Needs-setup state
  END IF;

  -- Find the matching level
  SELECT elem INTO v_level
  FROM jsonb_array_elements(v_levels -> 'levels') elem
  WHERE elem ->> 'level' = v_level_key
  LIMIT 1;

  IF v_level IS NULL THEN
    RETURN NULL; -- Level not found
  END IF;

  v_steps := v_level -> 'steps';

  -- Get step value (0-indexed)
  IF v_step_index < 0 OR v_step_index >= jsonb_array_length(v_steps) THEN
    RETURN NULL; -- Step index out of range
  END IF;

  v_salary := (v_steps -> v_step_index)::INTEGER;

  RETURN v_salary;
END;
$$;


--
-- Name: FUNCTION get_labor_category_salary(v_category_id uuid, v_level_key text, v_step_index integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_labor_category_salary(v_category_id uuid, v_level_key text, v_step_index integer) IS 'Get annual salary for category/level/step; returns NULL if needs-setup';


--
-- Name: get_labor_category_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_labor_category_tenant(v_category_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT tenant_id FROM tenant_labor_categories WHERE id = v_category_id;
$$;


--
-- Name: get_prescribed_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_prescribed_roles(v_proposal_id uuid) RETURNS TABLE(title text, labor_category text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    lr.title,
    lr.labor_category
  FROM intelligence_labor_requirements lr
  JOIN intelligence_versions iv ON lr.version_id = iv.id
  JOIN proposals p ON iv.id = p.active_intelligence_version_id
  WHERE p.id = v_proposal_id
    AND lr.is_prescribed = true
  ORDER BY lr.title;
END;
$$;


--
-- Name: FUNCTION get_prescribed_roles(v_proposal_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_prescribed_roles(v_proposal_id uuid) IS 'Returns prescribed roles for a proposal. Used by WBS validator to enforce role vocabulary on prescribed contracts.';


--
-- Name: get_staffing_effective_salary_cents(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_staffing_effective_salary_cents(v_assignment_id uuid) RETURNS bigint
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_assignment RECORD;
  v_catalog_salary INTEGER;
BEGIN
  SELECT
    salary_override_cents,
    labor_category_id,
    level_key,
    step_index
  INTO v_assignment
  FROM staffing_assignments
  WHERE id = v_assignment_id;

  -- 1. Override takes precedence
  IF v_assignment.salary_override_cents IS NOT NULL THEN
    RETURN v_assignment.salary_override_cents;
  END IF;

  -- 2. Catalog lookup
  IF v_assignment.labor_category_id IS NOT NULL AND v_assignment.level_key IS NOT NULL THEN
    v_catalog_salary := get_labor_category_salary(
      v_assignment.labor_category_id,
      v_assignment.level_key,
      COALESCE(v_assignment.step_index, 0)
    );

    IF v_catalog_salary IS NOT NULL THEN
      RETURN v_catalog_salary * 100; -- Convert dollars to cents
    END IF;
  END IF;

  -- 3. No salary determinable
  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION get_staffing_effective_salary_cents(v_assignment_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_staffing_effective_salary_cents(v_assignment_id uuid) IS 'Returns effective salary: override > catalog > NULL';


--
-- Name: increment_row_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_row_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.row_version := COALESCE(OLD.row_version, 0) + 1;
  RETURN NEW;
END;
$$;


--
-- Name: is_tenant_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tenant_admin(check_tenant_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = check_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
  );
$$;


--
-- Name: FUNCTION is_tenant_admin(check_tenant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_tenant_admin(check_tenant_id uuid) IS 'Check if current user is owner/admin of the given tenant. SECURITY DEFINER with hardened search_path.';


--
-- Name: is_tenant_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tenant_member(check_tenant_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE tenant_id = check_tenant_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;


--
-- Name: labor_category_needs_setup(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.labor_category_needs_setup(v_category_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT levels IS NULL
  FROM tenant_labor_categories
  WHERE id = v_category_id;
$$;


--
-- Name: FUNCTION labor_category_needs_setup(v_category_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.labor_category_needs_setup(v_category_id uuid) IS 'Returns true if category has NULL levels (needs configuration)';


--
-- Name: resolve_labor_category(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_labor_category(v_tenant_id uuid, v_role_title text) RETURNS public.labor_category_match
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_result labor_category_match;
  v_normalized_title TEXT;
BEGIN
  v_normalized_title := LOWER(TRIM(v_role_title));

  -- 1. Exact title match
  SELECT id, 'exact'::TEXT, 1.0::NUMERIC(3,2)
  INTO v_result.category_id, v_result.match_type, v_result.confidence
  FROM tenant_labor_categories
  WHERE tenant_id = v_tenant_id
    AND active = true
    AND LOWER(title) = v_normalized_title
  LIMIT 1;

  IF v_result.category_id IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- 2. Alias match
  SELECT lc.id, 'alias'::TEXT, 0.95::NUMERIC(3,2)
  INTO v_result.category_id, v_result.match_type, v_result.confidence
  FROM labor_category_aliases lca
  JOIN tenant_labor_categories lc ON lc.id = lca.labor_category_id
  WHERE lc.tenant_id = v_tenant_id
    AND lc.active = true
    AND LOWER(lca.alias) = v_normalized_title
  LIMIT 1;

  IF v_result.category_id IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- 3. Fuzzy match (contains or similar) - lower confidence
  -- First try: input contains category title
  SELECT id, 'fuzzy'::TEXT, 0.70::NUMERIC(3,2)
  INTO v_result.category_id, v_result.match_type, v_result.confidence
  FROM tenant_labor_categories
  WHERE tenant_id = v_tenant_id
    AND active = true
    AND (
      v_normalized_title LIKE '%' || LOWER(title) || '%'
      OR LOWER(title) LIKE '%' || v_normalized_title || '%'
    )
  ORDER BY LENGTH(title) DESC  -- Prefer longer matches
  LIMIT 1;

  IF v_result.category_id IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- 4. No match found
  v_result.category_id := NULL;
  v_result.match_type := 'unmapped';
  v_result.confidence := 0.0;

  RETURN v_result;
END;
$$;


--
-- Name: FUNCTION resolve_labor_category(v_tenant_id uuid, v_role_title text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.resolve_labor_category(v_tenant_id uuid, v_role_title text) IS 'Resolves role title to labor category with match type and confidence';


--
-- Name: seed_additional_catalog_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_additional_catalog_roles(v_tenant_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER := 0;
  v_sort INTEGER := 200; -- Start after FFTC roles
BEGIN
  -- Engineering discipline (additional)
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'fullstack_developer', 'Full-Stack Developer', 'engineering', NULL, v_sort),
    (v_tenant_id, 'software_architect', 'Software Architect', 'engineering', NULL, v_sort + 10),
    (v_tenant_id, 'solutions_architect', 'Solutions Architect', 'engineering', NULL, v_sort + 20),
    (v_tenant_id, 'platform_engineer', 'Platform Engineer', 'engineering', NULL, v_sort + 30),
    (v_tenant_id, 'sre', 'Site Reliability Engineer', 'engineering', NULL, v_sort + 40)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 5;

  -- Design discipline (additional)
  v_sort := 300;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'visual_designer', 'Visual Designer', 'design', NULL, v_sort),
    (v_tenant_id, 'interaction_designer', 'Interaction Designer', 'design', NULL, v_sort + 10)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 2;

  -- Research discipline (additional)
  v_sort := 400;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'service_designer', 'Service Designer', 'research', NULL, v_sort),
    (v_tenant_id, 'research_lead', 'Research Lead', 'research', NULL, v_sort + 10),
    (v_tenant_id, 'user_researcher', 'User Researcher', 'research', NULL, v_sort + 20)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 3;

  -- Delivery discipline (additional)
  v_sort := 500;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'business_analyst', 'Business Analyst', 'delivery', NULL, v_sort)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 1;

  -- Program Management discipline
  v_sort := 600;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'program_manager', 'Program Manager', 'program-management', NULL, v_sort),
    (v_tenant_id, 'agile_coach', 'Agile Coach', 'program-management', NULL, v_sort + 10)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 2;

  -- Data & Analytics discipline
  v_sort := 700;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'data_engineer', 'Data Engineer', 'data', NULL, v_sort),
    (v_tenant_id, 'data_analyst', 'Data Analyst', 'data', NULL, v_sort + 10),
    (v_tenant_id, 'data_scientist', 'Data Scientist', 'data', NULL, v_sort + 20),
    (v_tenant_id, 'ml_engineer', 'ML Engineer', 'data', NULL, v_sort + 30)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 4;

  -- Security discipline
  v_sort := 800;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'security_engineer', 'Security Engineer', 'security', NULL, v_sort),
    (v_tenant_id, 'security_analyst', 'Security Analyst', 'security', NULL, v_sort + 10),
    (v_tenant_id, 'security_architect', 'Security Architect', 'security', NULL, v_sort + 20)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 3;

  -- Content discipline (additional)
  v_sort := 900;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'content_strategist', 'Content Strategist', 'content', NULL, v_sort),
    (v_tenant_id, 'ux_writer', 'UX Writer', 'content', NULL, v_sort + 10)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 2;

  -- Accessibility discipline
  v_sort := 1000;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'accessibility_specialist', 'Accessibility Specialist', 'accessibility', NULL, v_sort)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 1;

  RETURN v_count;
END;
$$;


--
-- Name: FUNCTION seed_additional_catalog_roles(v_tenant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.seed_additional_catalog_roles(v_tenant_id uuid) IS 'Seeds 23 additional roles with NULL salaries (needs-setup)';


--
-- Name: seed_fftc_roles_from_json(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_fftc_roles_from_json(v_tenant_id uuid, v_roles_json jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role JSONB;
  v_key TEXT;
  v_discipline TEXT;
  v_levels JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR v_role IN SELECT * FROM jsonb_array_elements(v_roles_json)
  LOOP
    -- Generate key from title
    v_key := LOWER(REPLACE(REPLACE(REPLACE(
      v_role ->> 'title',
      ' ', '_'),
      '-', '_'),
      '/', '_'));

    -- Map title to discipline (Phase 5 spec mappings)
    v_discipline := CASE
      WHEN v_role ->> 'title' IN ('Back-end Developer', 'Front-end Developer', 'DevOps Engineer', 'QA Engineer', 'Technical Lead') THEN 'engineering'
      WHEN v_role ->> 'title' IN ('Product Designer', 'Design Lead') THEN 'design'
      WHEN v_role ->> 'title' = 'UX Researcher' THEN 'research'
      WHEN v_role ->> 'title' = 'Product Manager' THEN 'product'
      WHEN v_role ->> 'title' = 'Delivery Manager' THEN 'delivery'
      WHEN v_role ->> 'title' = 'Content/UX Writer' THEN 'content'
      ELSE 'engineering' -- Default fallback
    END;

    -- Transform salary_levels array to levels JSONB structure
    -- Input: [{ "level": "IC1", "level_title": "Associate", "steps": [87000, 89610] }, ...]
    -- Output: { "levels": [...] }
    v_levels := jsonb_build_object('levels', v_role -> 'salary_levels');

    INSERT INTO tenant_labor_categories (
      tenant_id,
      key,
      title,
      discipline_key,
      description,
      soc_code,
      education,
      levels,
      sort_order
    )
    VALUES (
      v_tenant_id,
      v_key,
      v_role ->> 'title',
      v_discipline,
      v_role ->> 'description',
      v_role ->> 'soc_code',
      v_role ->> 'education',
      v_levels,
      (v_count + 1) * 10
    )
    ON CONFLICT (tenant_id, key) DO UPDATE
    SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      soc_code = EXCLUDED.soc_code,
      education = EXCLUDED.education,
      levels = EXCLUDED.levels,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


--
-- Name: FUNCTION seed_fftc_roles_from_json(v_tenant_id uuid, v_roles_json jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.seed_fftc_roles_from_json(v_tenant_id uuid, v_roles_json jsonb) IS 'Seeds FFTC roles from fftc-roles-v2.json structure';


--
-- Name: seed_standard_aliases(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_standard_aliases(v_tenant_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_category_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Backend Developer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'backend_developer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'Software Engineer'),
      (v_category_id, 'Backend Engineer')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Frontend Developer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'frontend_developer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'UI Developer'),
      (v_category_id, 'Frontend Engineer')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- DevOps Engineer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'devops_engineer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'DevOps'),
      (v_category_id, 'Infrastructure Engineer'),
      (v_category_id, 'Cloud Engineer')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 3;
  END IF;

  -- QA Engineer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'qa_engineer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'QA'),
      (v_category_id, 'Quality Assurance Engineer'),
      (v_category_id, 'Test Engineer'),
      (v_category_id, 'SDET')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 4;
  END IF;

  -- Product Manager aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'product_manager';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'PM', NULL),
      (v_category_id, 'Product Lead', NULL),
      (v_category_id, 'Product Owner', 'Agile RFP title for product work')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 3;
  END IF;

  -- Product Designer aliases (HCD Lead umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'product_designer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'UX/UI Designer', NULL),
      (v_category_id, 'UX Designer', NULL),
      (v_category_id, 'UI Designer', NULL),
      (v_category_id, 'HCD Lead', 'Work is wireframes, prototypes, design systems, UI specs')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 4;
  END IF;

  -- UX Researcher aliases (HCD Lead umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'ux_researcher';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'User Researcher', NULL),
      (v_category_id, 'Research Analyst', NULL),
      (v_category_id, 'HCD Lead', 'Work is studies, synthesis, interviews, usability testing')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 3;
  END IF;

  -- Service Designer aliases (HCD Lead umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'service_designer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'HCD Lead', 'Work is journey maps, service blueprints, workshop facilitation'),
      (v_category_id, 'Journey Mapper', NULL)
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Research Lead aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'research_lead';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'Senior HCD Lead'),
      (v_category_id, 'Research Director')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Content/UX Writer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'content_ux_writer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'UX Writer'),
      (v_category_id, 'Microcopy Writer')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Delivery Manager aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'delivery_manager';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'Scrum Master', 'Agile RFP title for delivery work'),
      (v_category_id, 'Agile Delivery Lead', NULL)
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Technical Lead aliases (umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'technical_lead';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'Tech Lead', NULL),
      (v_category_id, 'Engineering Lead', NULL),
      (v_category_id, 'Lead Developer', NULL),
      (v_category_id, 'Technical Lead', 'Hands-on lead development — code review, mentorship, shipping code')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 4;
  END IF;

  -- Solutions Architect aliases (Technical Lead umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'solutions_architect';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'Enterprise Architect', NULL),
      (v_category_id, 'Cloud Architect', NULL),
      (v_category_id, 'Technical Lead', 'Architecture/technical strategy — system design, ADRs, cross-team technical decisions')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 3;
  END IF;

  -- Design Lead aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'design_lead';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'UX Lead'),
      (v_category_id, 'Design Director')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Accessibility Specialist aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'accessibility_specialist';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'A11y Engineer'),
      (v_category_id, '508 Compliance Specialist')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  RETURN v_count;
END;
$$;


--
-- Name: FUNCTION seed_standard_aliases(v_tenant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.seed_standard_aliases(v_tenant_id uuid) IS 'Seeds standard role aliases including HCD Lead umbrella';


--
-- Name: seed_tenant_disciplines(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_tenant_disciplines(v_tenant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Standard 10 disciplines per Phase 5 spec
  INSERT INTO tenant_disciplines (tenant_id, key, display_name, sort_order)
  VALUES
    (v_tenant_id, 'engineering', 'Engineering', 10),
    (v_tenant_id, 'design', 'Design', 20),
    (v_tenant_id, 'research', 'Research', 30),
    (v_tenant_id, 'product', 'Product', 40),
    (v_tenant_id, 'delivery', 'Delivery', 50),
    (v_tenant_id, 'program-management', 'Program Management', 60),
    (v_tenant_id, 'content', 'Content Strategy', 70),
    (v_tenant_id, 'accessibility', 'Accessibility', 80),
    (v_tenant_id, 'data', 'Data & Analytics', 90),
    (v_tenant_id, 'security', 'Security', 100)
  ON CONFLICT (tenant_id, key) DO NOTHING;
END;
$$;


--
-- Name: FUNCTION seed_tenant_disciplines(v_tenant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.seed_tenant_disciplines(v_tenant_id uuid) IS 'Seeds standard disciplines for a tenant; idempotent via ON CONFLICT';


--
-- Name: seed_tenant_labor_catalog(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_tenant_labor_catalog(v_tenant_id uuid) RETURNS TABLE(fftc_roles integer, additional_roles integer, aliases integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fftc INTEGER := 0;
  v_additional INTEGER;
  v_aliases INTEGER;
BEGIN
  -- Note: FFTC roles with salary data must be seeded via script
  -- This function seeds disciplines, additional roles, and aliases

  -- Ensure disciplines exist
  PERFORM seed_tenant_disciplines(v_tenant_id);

  -- Seed additional roles (NULL salaries)
  v_additional := seed_additional_catalog_roles(v_tenant_id);

  -- Seed aliases
  v_aliases := seed_standard_aliases(v_tenant_id);

  RETURN QUERY SELECT v_fftc, v_additional, v_aliases;
END;
$$;


--
-- Name: FUNCTION seed_tenant_labor_catalog(v_tenant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.seed_tenant_labor_catalog(v_tenant_id uuid) IS 'Master seed function for tenant catalog (disciplines, additional roles, aliases)';


--
-- Name: set_default_precedence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_default_precedence() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.precedence_rank = 0 THEN
    NEW.precedence_rank := CASE NEW.doc_type
      WHEN 'qa_amendment' THEN 30
      WHEN 'instructions' THEN 20
      WHEN 'pws_sow' THEN 10
      WHEN 'pricing_template' THEN 5
      ELSE 0
    END;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_intelligence_versions_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_intelligence_versions_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: update_proposal_sections_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_proposal_sections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_solicitation_documents_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_solicitation_documents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$                                                                                                                                                  
  BEGIN                                                                                                                                                                  
    NEW.updated_at = NOW();                                                                                                                                              
    RETURN NEW;                                                                                                                                                          
  END;                                                                                                                                                                   
  $$;


--
-- Name: v_block_active_wbs_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.v_block_active_wbs_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status = 'active' THEN
    RAISE EXCEPTION 'Cannot delete active WBS version %. Supersede it first.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: FUNCTION v_block_active_wbs_delete(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.v_block_active_wbs_delete() IS 'Prevents direct deletion of active WBS versions';


--
-- Name: v_block_child_mutation_on_superseded(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.v_block_child_mutation_on_superseded() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_parent_status wbs_status;
  v_version_id UUID;
BEGIN
  -- Determine the version_id based on operation and table
  IF TG_TABLE_NAME = 'wbs_tasks' THEN
    v_version_id := COALESCE(NEW.wbs_version_id, OLD.wbs_version_id);
  ELSIF TG_TABLE_NAME = 'staffing_assignments' THEN
    -- staffing_assignments references wbs_tasks, need to look up
    IF TG_OP = 'DELETE' THEN
      SELECT wt.wbs_version_id INTO v_version_id
      FROM wbs_tasks wt
      WHERE wt.id = OLD.wbs_task_id;
    ELSE
      SELECT wt.wbs_version_id INTO v_version_id
      FROM wbs_tasks wt
      WHERE wt.id = NEW.wbs_task_id;
    END IF;
  END IF;

  -- Look up parent version status
  SELECT status INTO v_parent_status
  FROM wbs_versions
  WHERE id = v_version_id;

  IF v_parent_status = 'superseded' THEN
    RAISE EXCEPTION 'Cannot modify % on superseded WBS version. History is immutable.',
      TG_TABLE_NAME;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


--
-- Name: FUNCTION v_block_child_mutation_on_superseded(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.v_block_child_mutation_on_superseded() IS 'Cascades immutability to tasks and assignments';


--
-- Name: v_block_superseded_wbs_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.v_block_superseded_wbs_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status = 'superseded' THEN
    RAISE EXCEPTION 'Cannot modify superseded WBS version %. History is immutable.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION v_block_superseded_wbs_mutation(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.v_block_superseded_wbs_mutation() IS 'Ensures superseded versions are fully immutable';


--
-- Name: v_enforce_intelligence_gate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.v_enforce_intelligence_gate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_intel_status intelligence_status;
BEGIN
  -- Look up the intelligence version's status
  SELECT status INTO v_intel_status
  FROM intelligence_versions
  WHERE id = NEW.intelligence_version_id;

  IF v_intel_status IS NULL THEN
    RAISE EXCEPTION 'Intelligence version % does not exist', NEW.intelligence_version_id;
  END IF;

  -- Rule 1: generated_candidate on INSERT requires confirmed intelligence
  IF TG_OP = 'INSERT' AND NEW.status = 'generated_candidate' THEN
    IF v_intel_status != 'confirmed' THEN
      RAISE EXCEPTION 'Cannot create generated_candidate WBS: intelligence version % is not confirmed (status: %)',
        NEW.intelligence_version_id, v_intel_status;
    END IF;
  END IF;

  -- Rule 2: Transition to active requires confirmed intelligence
  IF TG_OP = 'UPDATE' AND NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    IF v_intel_status != 'confirmed' THEN
      RAISE EXCEPTION 'Cannot activate WBS version: intelligence version % is not confirmed (status: %)',
        NEW.intelligence_version_id, v_intel_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: v_update_staffing_assignments_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.v_update_staffing_assignments_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: v_update_wbs_tasks_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.v_update_wbs_tasks_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: v_update_wbs_versions_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.v_update_wbs_versions_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_labor_category_levels(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_labor_category_levels() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_level JSONB;
  v_levels_array JSONB;
BEGIN
  -- NULL levels is valid (needs-setup state)
  IF NEW.levels IS NULL THEN
    RETURN NEW;
  END IF;

  -- Must have 'levels' key with array value
  IF NOT (NEW.levels ? 'levels') THEN
    RAISE EXCEPTION 'levels JSONB must have a "levels" key';
  END IF;

  v_levels_array := NEW.levels -> 'levels';

  IF jsonb_typeof(v_levels_array) != 'array' THEN
    RAISE EXCEPTION 'levels.levels must be an array';
  END IF;

  -- Each level must have required fields
  FOR v_level IN SELECT * FROM jsonb_array_elements(v_levels_array)
  LOOP
    IF NOT (v_level ? 'level') THEN
      RAISE EXCEPTION 'Each level must have a "level" key';
    END IF;

    IF NOT (v_level ? 'level_title') THEN
      RAISE EXCEPTION 'Each level must have a "level_title" key';
    END IF;

    IF NOT (v_level ? 'steps') THEN
      RAISE EXCEPTION 'Each level must have a "steps" key';
    END IF;

    IF jsonb_typeof(v_level -> 'steps') != 'array' THEN
      RAISE EXCEPTION 'level.steps must be an array';
    END IF;

    -- Steps array can have NULLs (per provenance rule: band value as step 1, NULLs for unpopulated steps)
    -- but must have at least one non-null value if array is non-empty
  END LOOP;

  RETURN NEW;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
    -- Regclass of the table e.g. public.notes
    entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

    -- I, U, D, T: insert, update ...
    action realtime.action = (
        case wal ->> 'action'
            when 'I' then 'INSERT'
            when 'U' then 'UPDATE'
            when 'D' then 'DELETE'
            else 'ERROR'
        end
    );

    -- Is row level security enabled for the table
    is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

    subscriptions realtime.subscription[] = array_agg(subs)
        from
            realtime.subscription subs
        where
            subs.entity = entity_
            -- Filter by action early - only get subscriptions interested in this action
            -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
            and (subs.action_filter = '*' or subs.action_filter = action::text);

    -- Subscription vars
    working_role regrole;
    working_selected_columns text[];
    claimed_role regrole;
    claims jsonb;

    subscription_id uuid;
    subscription_has_access bool;
    visible_to_subscription_ids uuid[] = '{}';

    -- structured info for wal's columns
    columns realtime.wal_column[];
    -- previous identity values for update/delete
    old_columns realtime.wal_column[];

    error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

    -- Primary jsonb output for record
    output jsonb;

    -- Loop record for iterating unique roles (outer loop)
    role_record record;
    -- Loop record for iterating unique selected_columns within a role (inner loop)
    cols_record record;
    -- Subscription ids visible at the role level (before fanning out by selected_columns)
    visible_role_sub_ids uuid[] = '{}';

begin
    perform set_config('role', null, true);

    columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'columns') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    old_columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'identity') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    for role_record in
        select claims_role
        from (select distinct claims_role from unnest(subscriptions)) t
        order by claims_role::text
    loop
        working_role := role_record.claims_role;

        -- Update `is_selectable` for columns and old_columns (once per role)
        columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(columns) c;

        old_columns =
                array_agg(
                    (
                        c.name,
                        c.type_name,
                        c.type_oid,
                        c.value,
                        c.is_pkey,
                        pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                    )::realtime.wal_column
                )
                from
                    unnest(old_columns) c;

        if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
            -- Fan out 400 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 400: Bad Request, no primary key']
                )::realtime.wal_rls;
            end loop;

        -- The claims role does not have SELECT permission to the primary key of entity
        elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
            -- Fan out 401 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 401: Unauthorized']
                )::realtime.wal_rls;
            end loop;

        else
            -- Create the prepared statement (once per role)
            if is_rls_enabled and action <> 'DELETE' then
                if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                    deallocate walrus_rls_stmt;
                end if;
                execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
            end if;

            -- Collect all visible subscription IDs for this role (filter check + RLS check)
            visible_role_sub_ids = '{}';

            for subscription_id, claims in (
                    select
                        subs.subscription_id,
                        subs.claims
                    from
                        unnest(subscriptions) subs
                    where
                        subs.entity = entity_
                        and subs.claims_role = working_role
                        and (
                            realtime.is_visible_through_filters(columns, subs.filters)
                            or (
                              action = 'DELETE'
                              and realtime.is_visible_through_filters(old_columns, subs.filters)
                            )
                        )
            ) loop

                if not is_rls_enabled or action = 'DELETE' then
                    visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                else
                    -- Check if RLS allows the role to see the record
                    perform
                        -- Trim leading and trailing quotes from working_role because set_config
                        -- doesn't recognize the role as valid if they are included
                        set_config('role', trim(both '"' from working_role::text), true),
                        set_config('request.jwt.claims', claims::text, true);

                    execute 'execute walrus_rls_stmt' into subscription_has_access;

                    if subscription_has_access then
                        visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                    end if;
                end if;
            end loop;

            perform set_config('role', null, true);

            -- Inner loop: per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;

                output = jsonb_build_object(
                    'schema', wal ->> 'schema',
                    'table', wal ->> 'table',
                    'type', action,
                    'commit_timestamp', to_char(
                        ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ),
                    'columns', (
                        select
                            jsonb_agg(
                                jsonb_build_object(
                                    'name', pa.attname,
                                    'type', pt.typname
                                )
                                order by pa.attnum asc
                            )
                        from
                            pg_attribute pa
                            join pg_type pt
                                on pa.atttypid = pt.oid
                            left join (
                                select unnest(conkey) as pkey_attnum
                                from pg_constraint
                                where conrelid = entity_ and contype = 'p'
                            ) pk on pk.pkey_attnum = pa.attnum
                        where
                            attrelid = entity_
                            and attnum > 0
                            and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
                            and (working_selected_columns is null or pa.attname = any(working_selected_columns) or pk.pkey_attnum is not null)
                    )
                )
                -- Add "record" key for insert and update
                || case
                    when action in ('INSERT', 'UPDATE') then
                        jsonb_build_object(
                            'record',
                            (
                                select
                                    jsonb_object_agg(
                                        -- if unchanged toast, get column name and value from old record
                                        coalesce((c).name, (oc).name),
                                        case
                                            when (c).name is null then (oc).value
                                            else (c).value
                                        end
                                    )
                                from
                                    unnest(columns) c
                                    full outer join unnest(old_columns) oc
                                        on (c).name = (oc).name
                                where
                                    coalesce((c).is_selectable, (oc).is_selectable)
                                    and (working_selected_columns is null or coalesce((c).name, (oc).name) = any(working_selected_columns) or coalesce((c).is_pkey, (oc).is_pkey))
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            )
                        )
                    else '{}'::jsonb
                end
                -- Add "old_record" key for update and delete
                || case
                    when action = 'UPDATE' then
                        jsonb_build_object(
                                'old_record',
                                (
                                    select jsonb_object_agg((c).name, (c).value)
                                    from unnest(old_columns) c
                                    where
                                        (c).is_selectable
                                        and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                        and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                )
                            )
                    when action = 'DELETE' then
                        jsonb_build_object(
                            'old_record',
                            (
                                select jsonb_object_agg((c).name, (c).value)
                                from unnest(old_columns) c
                                where
                                    (c).is_selectable
                                    and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                    and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                            )
                        )
                    else '{}'::jsonb
                end;

                -- Filter visible_role_sub_ids to those matching the current selected_columns group
                visible_to_subscription_ids = coalesce(
                    (
                        select array_agg(s.subscription_id)
                        from unnest(subscriptions) s
                        where s.claims_role = working_role
                          and (s.selected_columns is not distinct from working_selected_columns)
                          and s.subscription_id = any(visible_role_sub_ids)
                    ),
                    '{}'::uuid[]
                );

                return next (
                    output,
                    is_rls_enabled,
                    visible_to_subscription_ids,
                    case
                        when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                        else '{}'
                    end
                )::realtime.wal_rls;
            end loop;

        end if;
    end loop;

    perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
/*
Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
*/
declare
    op_symbol text = (
        case
            when op = 'eq' then '='
            when op = 'neq' then '!='
            when op = 'lt' then '<'
            when op = 'lte' then '<='
            when op = 'gt' then '>'
            when op = 'gte' then '>='
            when op = 'in' then '= any'
            else 'UNKNOWN OP'
        end
    );
    res boolean;
begin
    execute format(
        'select %L::'|| type_::text || ' ' || op_symbol
        || ' ( %L::'
        || (
            case
                when op = 'in' then type_::text || '[]'
                else type_::text end
        )
        || ')', val_1, val_2) into res;
    return res;
end;
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
declare
    op_symbol text;
    res boolean;
begin
    -- IS DISTINCT FROM / IS NOT DISTINCT FROM: infix, both sides typed literals
    if op = 'isdistinct' then
        execute format(
            'select %L::%s %s %L::%s',
            val_1,
            type_::text,
            case when negate then 'IS NOT DISTINCT FROM' else 'IS DISTINCT FROM' end,
            val_2,
            type_::text
        ) into res;
        return res;
    end if;

    -- IS requires a keyword RHS (NULL, TRUE, FALSE, UNKNOWN), not a typed literal
    if op = 'is' then
        if val_2 not in ('null', 'true', 'false', 'unknown') then
            raise exception 'invalid value for is filter: must be null, true, false, or unknown';
        end if;
        execute format(
            'select %L::%s %s %s',
            val_1,
            type_::text,
            case when negate then 'IS NOT' else 'IS' end,
            upper(val_2)
        ) into res;
        return res;
    end if;

    op_symbol = case
        when op = 'eq'    then '='
        when op = 'neq'   then '!='
        when op = 'lt'    then '<'
        when op = 'lte'   then '<='
        when op = 'gt'    then '>'
        when op = 'gte'   then '>='
        when op = 'in'    then '= any'
        when op = 'like'   then 'LIKE'
        when op = 'ilike'  then 'ILIKE'
        when op = 'match'  then '~'
        when op = 'imatch' then '~*'
        else null
    end;

    if op_symbol is null then
        raise exception 'unsupported equality operator: %', op::text;
    end if;

    execute format(
        'select %L::%s %s (%L::%s)',
        val_1,
        type_::text,
        op_symbol,
        val_2,
        case when op = 'in' then type_::text || '[]' else type_::text end
    ) into res;

    return case when negate then not res else res end;
end;
$$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select
        filters is null
        or array_length(filters, 1) is null
        or coalesce(
            count(col.name) = count(1)
            and sum(
                realtime.check_equality_op(
                    op:=f.op,
                    type_:=coalesce(col.type_oid::regtype, col.type_name::regtype),
                    val_1:=col.value #>> '{}',
                    val_2:=f.value,
                    negate:=coalesce(f.negate, false)
                )::int
            ) filter (where col.name is not null) = count(col.name),
            false
        )
    from
        unnest(filters) f
        left join unnest(columns) col
            on f.column_name = col.name;
$$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  SELECT
    realtime.wal2json_escape_identifier(nsp.nspname::text)
    || '.'
    || realtime.wal2json_escape_identifier(pc.relname::text)
  FROM pg_class pc
  JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
  WHERE pc.oid = entity
$$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: send_binary(bytea, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, binary_payload, event, topic, private, extension)
    VALUES (generated_id, payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
    col_names text[] = coalesce(
            array_agg(a.attname order by a.attnum),
            '{}'::text[]
        )
        from
            pg_catalog.pg_attribute a
        where
            a.attrelid = new.entity
            and a.attnum > 0
            and not a.attisdropped
            and pg_catalog.has_column_privilege(
                (new.claims ->> 'role'),
                a.attrelid,
                a.attnum,
                'SELECT'
            );
    filter realtime.user_defined_filter;
    col_type regtype;
    in_val jsonb;
    selected_col text;
begin
    for filter in select * from unnest(new.filters) loop
        if not filter.column_name = any(col_names) then
            raise exception 'invalid column for filter %', filter.column_name;
        end if;

        col_type = (
            select atttypid::regtype
            from pg_catalog.pg_attribute
            where attrelid = new.entity
                  and attname = filter.column_name
        );
        if col_type is null then
            raise exception 'failed to lookup type for column %', filter.column_name;
        end if;

        if filter.op = 'in'::realtime.equality_op then
            in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
            if coalesce(jsonb_array_length(in_val), 0) > 100 then
                raise exception 'too many values for `in` filter. Maximum 100';
            end if;
        elsif filter.op = 'is'::realtime.equality_op then
            -- `is` requires a keyword RHS rather than a typed literal
            if filter.value not in ('null', 'true', 'false', 'unknown') then
                raise exception 'invalid value for is filter: must be null, true, false, or unknown';
            end if;
            -- IS NULL works for any type, but IS TRUE/FALSE/UNKNOWN require a boolean
            -- operand. Reject the non-null keywords on non-boolean columns here so they
            -- don't abort apply_rls at WAL time.
            if filter.value <> 'null' and col_type <> 'boolean'::regtype then
                raise exception 'is % filter requires a boolean column, got %', filter.value, col_type::text;
            end if;
        elsif filter.op in ('like'::realtime.equality_op, 'ilike'::realtime.equality_op) then
            -- like/ilike apply the text pattern operator (~~); reject column types that
            -- have no such operator instead of failing at WAL time
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = '~~' and oprleft = col_type
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
        elsif filter.op in ('match'::realtime.equality_op, 'imatch'::realtime.equality_op) then
            -- match/imatch apply the regex operators ~ / ~*; reject column types that have
            -- no such operator (e.g. integer) instead of failing at WAL time, mirroring the
            -- like/ilike guard above.
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = case when filter.op = 'imatch'::realtime.equality_op then '~*' else '~' end
                  and oprleft = col_type
                  and oprright = col_type
                  and oprresult = 'boolean'::regtype
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
            -- validate the regex eagerly so a bad pattern is rejected here, not inside
            -- apply_rls where it would abort the WAL stream for the entity
            begin
                perform '' ~ filter.value;
            exception when others then
                raise exception 'invalid regular expression for % filter: %', filter.op::text, sqlerrm;
            end;
        else
            -- eq/neq/lt/lte/gt/gte: value must be coercable to the type
            perform realtime.cast(filter.value, col_type);
        end if;
    end loop;

    if new.selected_columns is not null then
        for selected_col in select * from unnest(new.selected_columns) loop
            if not selected_col = any(col_names) then
                raise exception 'invalid column for select %', selected_col;
            end if;
        end loop;
    end if;

    -- Apply consistent order to filters so the unique constraint can't be tricked by a
    -- different filter order. negate is part of the sort key.
    new.filters = coalesce(
        array_agg(f order by f.column_name, f.op, f.value, f.negate),
        '{}'
    ) from unnest(new.filters) f;

    new.selected_columns = (
        select array_agg(c order by c)
        from unnest(new.selected_columns) c
    );

    return new;
end;
$$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: wal2json_escape_identifier(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.wal2json_escape_identifier(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  -- Prefix `\`, `,`, `.`, and any whitespace with `\`
  SELECT regexp_replace(name, '([\\,.[:space:]])', '\\\1', 'g')
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_type text NOT NULL,
    actor_id text NOT NULL,
    command_name text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    before_version integer,
    after_version integer NOT NULL,
    changed_fields jsonb,
    command_input jsonb,
    correlation_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_events_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'system'::text, 'ai_job'::text])))
);


--
-- Name: TABLE audit_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_events IS 'Immutable audit log of all command executions';


--
-- Name: COLUMN audit_events.actor_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_events.actor_type IS 'user=authenticated user, system=background job, ai_job=AI processing';


--
-- Name: COLUMN audit_events.before_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_events.before_version IS 'NULL for create operations';


--
-- Name: COLUMN audit_events.changed_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_events.changed_fields IS 'JSON object with field names as keys, {old, new} as values';


--
-- Name: COLUMN audit_events.correlation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_events.correlation_id IS 'Links related events across multiple commands in a logical operation';


--
-- Name: backfill_rate_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backfill_rate_snapshot (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    role_title text NOT NULL,
    discipline text NOT NULL,
    current_salary_cents bigint,
    bill_rate_base_cents bigint,
    selected_level text,
    selected_step integer,
    profit_margin numeric(5,4) DEFAULT 0.10 NOT NULL,
    resolution_path text NOT NULL,
    fringe_rate numeric(6,4) NOT NULL,
    overhead_rate numeric(6,4) NOT NULL,
    ga_rate numeric(6,4) NOT NULL,
    matched_category_id uuid,
    match_type text,
    new_salary_cents bigint,
    new_bill_rate_cents bigint,
    has_override boolean DEFAULT false,
    discrepancy_cents bigint,
    requires_manual_review boolean DEFAULT false,
    review_reason text,
    snapshot_at timestamp with time zone DEFAULT now(),
    backfill_at timestamp with time zone
);


--
-- Name: TABLE backfill_rate_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.backfill_rate_snapshot IS 'Pre-backfill snapshot for rate conservation verification';


--
-- Name: COLUMN backfill_rate_snapshot.discrepancy_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.backfill_rate_snapshot.discrepancy_cents IS 'Difference between old and new bill rates; 0 = conserved';


--
-- Name: COLUMN backfill_rate_snapshot.requires_manual_review; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.backfill_rate_snapshot.requires_manual_review IS 'True if discipline was ambiguous or role unmapped';


--
-- Name: boe_share_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boe_share_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    token text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    view_count integer DEFAULT 0 NOT NULL,
    last_viewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    link_type text DEFAULT 'accountant'::text,
    label text,
    reviewer_email text,
    approval_status text DEFAULT 'pending'::text,
    accountant_note text,
    approved_at timestamp with time zone,
    CONSTRAINT valid_link_type CHECK ((link_type = ANY (ARRAY['accountant'::text, 'boe'::text])))
);


--
-- Name: collab_section_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collab_section_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    proposal_id uuid,
    company_id uuid,
    link_type text NOT NULL,
    label text,
    reviewer_email text,
    reviewer_name text,
    section_ids text[] NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone,
    submission_status text DEFAULT 'pending'::text,
    submitted_at timestamp with time zone,
    submission_content jsonb,
    transformed_content jsonb,
    reviewer_note text,
    approved_at timestamp with time zone,
    CONSTRAINT collab_section_links_link_type_check CHECK ((link_type = ANY (ARRAY['contributor'::text, 'subcontractor'::text]))),
    CONSTRAINT collab_section_links_submission_status_check CHECK ((submission_status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'transform_pending'::text, 'transform_approved'::text])))
);


--
-- Name: collab_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collab_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    reviewer_name text NOT NULL,
    reviewer_title text,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    assigned_wbs_ids text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    completed_at timestamp with time zone,
    CONSTRAINT collab_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'expired'::text])))
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    legal_name text,
    sam_uei text,
    cage_code text,
    duns_number text,
    ein text,
    naics_codes text[],
    street_address text,
    city text,
    state text,
    zip_code text,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    address jsonb DEFAULT '{}'::jsonb,
    gsa_contract_number text,
    gsa_mas_schedule boolean DEFAULT false,
    idiq_contracts jsonb DEFAULT '[]'::jsonb,
    duns text,
    gsa_config jsonb DEFAULT '{}'::jsonb
);


--
-- Name: COLUMN companies.gsa_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.gsa_config IS 'GSA Schedule configuration: {
  gsaMasSchedule: boolean,
  gsaContractNumber: string,
  gsaEscalationRate: number,
  gsaBaseYear: number,
  gsaSins: [{ id, sin, title, laborCategories: [{ id, laborCategory, hourlyRate, ... }] }]
}';


--
-- Name: company_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    title text NOT NULL,
    labor_category text,
    soc_code text,
    education jsonb,
    certifications text[],
    min_years_experience integer,
    base_salary numeric(10,2),
    level_salaries jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    functional_responsibilities text,
    soc_title text,
    gsa_labor_category text,
    gsa_sin text,
    sca_code text,
    sca_occupation text,
    category text,
    notes text,
    salary_levels jsonb DEFAULT '[]'::jsonb
);


--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    fringe_rate numeric(5,4),
    overhead_rate numeric(5,4),
    ga_rate numeric(5,4),
    profit_rate numeric(5,4) DEFAULT 0.10,
    escalation_rate numeric(5,4) DEFAULT 0.03,
    gsa_contract_number text,
    gsa_expiration_date date,
    gsa_sins jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    writing_guide jsonb DEFAULT '{}'::jsonb,
    content_library jsonb DEFAULT '{}'::jsonb,
    profit_targets jsonb DEFAULT '{"tm": 0.08, "ffp": 0.10, "gsa": 0.08, "cpff": 0.08, "cpif": 0.10, "hybrid": 0.10}'::jsonb,
    tenant_id uuid,
    voice_description text,
    reading_level text,
    words_to_avoid text[],
    CONSTRAINT company_settings_reading_level_check CHECK ((reading_level = ANY (ARRAY['grade_8'::text, 'grade_10'::text, 'grade_12'::text, 'professional'::text])))
);


--
-- Name: COLUMN company_settings.writing_guide; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_settings.writing_guide IS 'FFTC Writing Guide configuration: {
  voice_description: string,
  reading_level: string,
  sentence_rules: string[],
  words_to_avoid: string[],
  words_to_use: string[],
  structural_rules: string[],
  example_sentences: string[]
}';


--
-- Name: COLUMN company_settings.content_library; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_settings.content_library IS 'Content library for proposals: {
  pastPerformance: [...],
  standardApproaches: [...]
}';


--
-- Name: COLUMN company_settings.profit_targets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_settings.profit_targets IS 'Profit margin targets by contract type (decimal). FFP default is 10% (Low risk). Medium (12%) and High (15%) require explicit selection.';


--
-- Name: COLUMN company_settings.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_settings.tenant_id IS 'Direct link to tenant for scoped queries';


--
-- Name: COLUMN company_settings.voice_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_settings.voice_description IS 'Description of company writing voice/tone for AI generation';


--
-- Name: COLUMN company_settings.reading_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_settings.reading_level IS 'Target reading level: grade_8, grade_10, grade_12, professional';


--
-- Name: COLUMN company_settings.words_to_avoid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_settings.words_to_avoid IS 'Array of words/phrases to avoid in generated content';


--
-- Name: compliance_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    requirement_id uuid,
    requirement_text text NOT NULL,
    requirement_ref text NOT NULL,
    proposal_section text NOT NULL,
    compliance_status text NOT NULL,
    notes text DEFAULT ''::text,
    owner text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source text DEFAULT 'requirement'::text,
    linked_wbs_ids uuid[] DEFAULT '{}'::uuid[],
    CONSTRAINT compliance_items_compliance_status_check CHECK ((compliance_status = ANY (ARRAY['compliant'::text, 'partial'::text, 'exception'::text, 'na'::text, 'unaddressed'::text]))),
    CONSTRAINT compliance_items_source_check CHECK ((source = ANY (ARRAY['requirement'::text, 'instruction'::text])))
);


--
-- Name: content_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    use_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT content_library_type_check CHECK ((type = ANY (ARRAY['past_performance'::text, 'key_personnel'::text, 'capability_statement'::text, 'standard_approach'::text, 'win_theme'::text])))
);


--
-- Name: gsa_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gsa_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    labor_category text NOT NULL,
    sin text NOT NULL,
    schedule_name text DEFAULT 'GSA MAS'::text,
    year_1_rate numeric(10,2),
    year_2_rate numeric(10,2),
    year_3_rate numeric(10,2),
    year_4_rate numeric(10,2),
    year_5_rate numeric(10,2),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    years_experience integer,
    education text,
    education_substitution text
);


--
-- Name: intelligence_disciplines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intelligence_disciplines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_id uuid NOT NULL,
    discipline text NOT NULL,
    confidence text NOT NULL,
    source_text text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT intelligence_disciplines_confidence_check CHECK ((confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT intelligence_disciplines_discipline_check CHECK ((discipline = ANY (ARRAY['engineering'::text, 'design'::text, 'research'::text, 'product'::text, 'delivery'::text, 'program-management'::text, 'content'::text, 'accessibility'::text, 'data'::text, 'security'::text])))
);


--
-- Name: TABLE intelligence_disciplines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.intelligence_disciplines IS 'Required disciplines (engineering, design, etc.) extracted from RFP';


--
-- Name: intelligence_labor_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intelligence_labor_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_id uuid NOT NULL,
    title text NOT NULL,
    labor_category text,
    hours_per_month numeric(8,2),
    utilization_pct numeric(5,2),
    appears_in_periods text[] DEFAULT '{}'::text[],
    confidence text NOT NULL,
    source_text text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_prescribed boolean DEFAULT false NOT NULL,
    labor_category_id uuid,
    match_type text,
    match_confidence numeric(3,2),
    CONSTRAINT intelligence_labor_requirements_confidence_check CHECK ((confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT intelligence_labor_requirements_match_type_check CHECK ((match_type = ANY (ARRAY['exact'::text, 'alias'::text, 'fuzzy'::text, 'unmapped'::text]))),
    CONSTRAINT intelligence_labor_requirements_utilization_pct_check CHECK (((utilization_pct >= (0)::numeric) AND (utilization_pct <= (100)::numeric)))
);


--
-- Name: TABLE intelligence_labor_requirements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.intelligence_labor_requirements IS 'Extracted role/position requirements from RFP';


--
-- Name: COLUMN intelligence_labor_requirements.appears_in_periods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_labor_requirements.appears_in_periods IS 'Array of period names where this role is required';


--
-- Name: COLUMN intelligence_labor_requirements.is_prescribed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_labor_requirements.is_prescribed IS 'True if this role is explicitly named in the RFP as key personnel or required position, not inferred from scope of work.';


--
-- Name: COLUMN intelligence_labor_requirements.labor_category_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_labor_requirements.labor_category_id IS 'Matched labor category; NULL = unmapped role (valid outcome)';


--
-- Name: COLUMN intelligence_labor_requirements.match_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_labor_requirements.match_type IS 'How the role title was matched: exact, alias, fuzzy, or unmapped';


--
-- Name: COLUMN intelligence_labor_requirements.match_confidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_labor_requirements.match_confidence IS 'Match confidence score (0.0-1.0)';


--
-- Name: intelligence_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intelligence_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_id uuid NOT NULL,
    name text NOT NULL,
    months numeric(5,2) NOT NULL,
    cumulative_months_end numeric(6,2) NOT NULL,
    gsa_rate_year integer NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT intelligence_periods_gsa_rate_year_check CHECK (((gsa_rate_year >= 1) AND (gsa_rate_year <= 5)))
);


--
-- Name: TABLE intelligence_periods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.intelligence_periods IS 'Contract periods (Base, Option 1, etc.) extracted from RFP';


--
-- Name: intelligence_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intelligence_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    status public.intelligence_status DEFAULT 'draft'::public.intelligence_status NOT NULL,
    confirmation_hash text,
    facts_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    contract_type text,
    row_version integer DEFAULT 1 NOT NULL,
    extracted_at timestamp with time zone DEFAULT now(),
    confirmed_at timestamp with time zone,
    superseded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    document_set_hash text,
    fact_conflicts jsonb DEFAULT '[]'::jsonb,
    staffing_model public.staffing_model DEFAULT 'unclear'::public.staffing_model NOT NULL,
    CONSTRAINT confirmed_at_required_when_confirmed CHECK (((status <> 'confirmed'::public.intelligence_status) OR (confirmed_at IS NOT NULL))),
    CONSTRAINT hash_required_when_confirmed CHECK (((status <> 'confirmed'::public.intelligence_status) OR (confirmation_hash IS NOT NULL))),
    CONSTRAINT intelligence_versions_contract_type_check CHECK ((contract_type = ANY (ARRAY['FFP'::text, 'T&M'::text, 'IDIQ'::text, 'BPA'::text, 'CPFF'::text, 'unknown'::text])))
);


--
-- Name: TABLE intelligence_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.intelligence_versions IS 'Versioned contract intelligence extractions with immutability guarantees';


--
-- Name: COLUMN intelligence_versions.confirmation_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_versions.confirmation_hash IS 'SHA-256 hash of canonical serialization, computed from fresh DB read-back on confirmation';


--
-- Name: COLUMN intelligence_versions.facts_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_versions.facts_json IS 'JSONB containing documentType, vehicle, contractType, setAside, rateSource with confidence';


--
-- Name: COLUMN intelligence_versions.document_set_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_versions.document_set_hash IS 'SHA-256 of sorted document content hashes; new document invalidates existing versions requiring re-extraction';


--
-- Name: COLUMN intelligence_versions.fact_conflicts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_versions.fact_conflicts IS 'Array of fact conflicts when multiple documents provide different values for the same fact. Structure: [{factKey, documents: [{documentId, documentType, value, precedenceRank}], resolvedValue, resolutionSource}]';


--
-- Name: COLUMN intelligence_versions.staffing_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intelligence_versions.staffing_model IS 'Whether the RFP prescribes specific roles (closed vocabulary) or expects offeror-proposed staffing. ''unclear'' requires user resolution before WBS generation.';


--
-- Name: labor_category_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labor_category_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    labor_category_id uuid NOT NULL,
    alias text NOT NULL,
    context_note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE labor_category_aliases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.labor_category_aliases IS 'Alternative titles that map to canonical labor categories';


--
-- Name: COLUMN labor_category_aliases.alias; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.labor_category_aliases.alias IS 'Alternative role title (HCD Lead, Scrum Master, etc.)';


--
-- Name: COLUMN labor_category_aliases.context_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.labor_category_aliases.context_note IS 'Disambiguation guidance for umbrella aliases like HCD Lead';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['collab_submitted'::text, 'boe_approved'::text, 'boe_corrections'::text])))
);


--
-- Name: proposal_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    parent_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    section_number text,
    title text NOT NULL,
    summary text,
    content text,
    instructions text,
    compliance_item_ids text[] DEFAULT '{}'::text[],
    requirement_refs text[] DEFAULT '{}'::text[],
    status text DEFAULT 'draft'::text NOT NULL,
    target_word_count integer,
    actual_word_count integer DEFAULT 0,
    owner text,
    notes text,
    ai_generated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    content_text text,
    last_edited_by text,
    last_edited_at timestamp with time zone,
    CONSTRAINT proposal_sections_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'review'::text, 'complete'::text, 'locked'::text])))
);


--
-- Name: proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    title text NOT NULL,
    solicitation_number text,
    client_agency text,
    status text DEFAULT 'draft'::text,
    contract_type text DEFAULT 'tm'::text,
    due_date date,
    estimated_value numeric(12,2),
    period_of_performance jsonb DEFAULT '{"baseYear": true, "optionYears": 2}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    total_value numeric(15,2),
    team_size integer,
    progress integer DEFAULT 0,
    starred boolean DEFAULT false,
    archived boolean DEFAULT false,
    client text,
    agency text,
    working_data jsonb DEFAULT '{}'::jsonb,
    strategy jsonb DEFAULT '{}'::jsonb,
    ai_summary jsonb DEFAULT '{}'::jsonb,
    row_version integer DEFAULT 1 NOT NULL,
    active_intelligence_version_id uuid
);


--
-- Name: COLUMN proposals.working_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.proposals.working_data IS 'Full proposal workspace state: solicitation, selectedRoles, subcontractors, teamingPartners, estimateWbsElements, rateJustifications, odcs, perDiem';


--
-- Name: COLUMN proposals.row_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.proposals.row_version IS 'Optimistic concurrency control: auto-increments on each update';


--
-- Name: COLUMN proposals.active_intelligence_version_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.proposals.active_intelligence_version_id IS 'Currently active (confirmed) intelligence version for WBS generation';


--
-- Name: requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid,
    reference_number text,
    title text NOT NULL,
    description text,
    type text DEFAULT 'shall'::text,
    category text,
    source text,
    priority text DEFAULT 'medium'::text,
    linked_wbs_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    linked_wbs_ids uuid[] DEFAULT '{}'::uuid[]
);


--
-- Name: section_coaching; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_coaching (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id text NOT NULL,
    proposal_id uuid NOT NULL,
    scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    feedback jsonb DEFAULT '[]'::jsonb NOT NULL,
    overall_assessment text,
    generated_at timestamp with time zone DEFAULT now(),
    content_snapshot text
);


--
-- Name: solicitation_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitation_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    storage_path text NOT NULL,
    filename text NOT NULL,
    file_size_bytes integer NOT NULL,
    page_count integer,
    doc_type public.document_type DEFAULT 'other'::public.document_type NOT NULL,
    doc_type_source public.doc_type_source DEFAULT 'ai_classified'::public.doc_type_source NOT NULL,
    classification_confidence numeric(3,2),
    classification_rationale text,
    precedence_rank integer DEFAULT 0 NOT NULL,
    status public.document_status DEFAULT 'uploaded'::public.document_status NOT NULL,
    raw_text text,
    content_hash text,
    error_message text,
    row_version integer DEFAULT 1 NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    classified_at timestamp with time zone,
    extracted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT solicitation_documents_classification_confidence_check CHECK (((classification_confidence >= (0)::numeric) AND (classification_confidence <= (1)::numeric)))
);


--
-- Name: TABLE solicitation_documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.solicitation_documents IS 'Phase 4B Pillar 1: Multi-document solicitation support. Each proposal can have multiple documents with classification and precedence ordering.';


--
-- Name: COLUMN solicitation_documents.precedence_rank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.solicitation_documents.precedence_rank IS 'Higher rank wins on conflicting facts. Default: qa_amendment=30, instructions=20, pws_sow=10, other=0';


--
-- Name: COLUMN solicitation_documents.content_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.solicitation_documents.content_hash IS 'SHA-256 of raw_text; used to detect when document content changes and re-extraction is needed';


--
-- Name: staffing_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staffing_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    wbs_task_id uuid NOT NULL,
    role_title text NOT NULL,
    discipline text NOT NULL,
    prime_or_sub public.prime_or_sub NOT NULL,
    subcontractor_name text,
    period_label text NOT NULL,
    hours numeric(10,2) NOT NULL,
    hours_per_month numeric(8,2),
    rationale text,
    source public.staffing_source DEFAULT 'generated'::public.staffing_source NOT NULL,
    user_modified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    row_version integer DEFAULT 1 NOT NULL,
    notes_jsonb jsonb DEFAULT '{}'::jsonb,
    labor_category_id uuid,
    level_key text,
    step_index integer,
    salary_override_cents bigint,
    bill_rate_override_cents bigint,
    profit_margin_override numeric(5,4),
    rate_source public.rate_source_type,
    CONSTRAINT bill_rate_override_positive CHECK (((bill_rate_override_cents IS NULL) OR (bill_rate_override_cents > 0))),
    CONSTRAINT level_requires_category CHECK (((level_key IS NULL) OR (labor_category_id IS NOT NULL))),
    CONSTRAINT profit_margin_valid CHECK (((profit_margin_override IS NULL) OR ((profit_margin_override >= (0)::numeric) AND (profit_margin_override <= (1)::numeric)))),
    CONSTRAINT salary_override_positive CHECK (((salary_override_cents IS NULL) OR (salary_override_cents > 0))),
    CONSTRAINT staffing_assignments_hours_check CHECK ((hours >= (0)::numeric)),
    CONSTRAINT step_index_non_negative CHECK (((step_index IS NULL) OR (step_index >= 0))),
    CONSTRAINT step_requires_level CHECK (((step_index IS NULL) OR (level_key IS NOT NULL))),
    CONSTRAINT sub_requires_name CHECK (((prime_or_sub <> 'sub'::public.prime_or_sub) OR (subcontractor_name IS NOT NULL)))
);


--
-- Name: TABLE staffing_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.staffing_assignments IS 'Per-task, per-period labor allocations replacing laborEstimates arrays';


--
-- Name: COLUMN staffing_assignments.role_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.role_title IS 'Role name (tenant labor catalog FK in Phase 5)';


--
-- Name: COLUMN staffing_assignments.discipline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.discipline IS 'Must match intelligence_disciplines for the WBS version';


--
-- Name: COLUMN staffing_assignments.prime_or_sub; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.prime_or_sub IS 'FAR requirement: prime contractor or subcontractor labor';


--
-- Name: COLUMN staffing_assignments.period_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.period_label IS 'Matches intelligence_periods.name (e.g., "Base Period")';


--
-- Name: COLUMN staffing_assignments.hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.hours IS 'Total hours for this role on this task in this period';


--
-- Name: COLUMN staffing_assignments.hours_per_month; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.hours_per_month IS 'Optional monthly utilization rate';


--
-- Name: COLUMN staffing_assignments.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.source IS 'generated = from AI, user_added = manually created';


--
-- Name: COLUMN staffing_assignments.user_modified; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.user_modified IS 'True if user has edited a generated assignment';


--
-- Name: COLUMN staffing_assignments.notes_jsonb; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.notes_jsonb IS 'BOE-critical fields: basisOfEstimate';


--
-- Name: COLUMN staffing_assignments.labor_category_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.labor_category_id IS 'Link to tenant labor catalog; NULL = unmapped role';


--
-- Name: COLUMN staffing_assignments.level_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.level_key IS 'Selected level within category (IC1, IC2, etc.)';


--
-- Name: COLUMN staffing_assignments.step_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.step_index IS '0-based step index within level';


--
-- Name: COLUMN staffing_assignments.salary_override_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.salary_override_cents IS 'Manual salary override in cents; takes precedence over catalog';


--
-- Name: COLUMN staffing_assignments.bill_rate_override_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.bill_rate_override_cents IS 'Manual bill rate override in cents';


--
-- Name: COLUMN staffing_assignments.profit_margin_override; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.profit_margin_override IS 'Override profit margin (0.0-1.0)';


--
-- Name: COLUMN staffing_assignments.rate_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staffing_assignments.rate_source IS 'Indicates how pricing was determined';


--
-- Name: tenant_disciplines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_disciplines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    key text NOT NULL,
    display_name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE tenant_disciplines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_disciplines IS 'Tenant-scoped discipline taxonomy for labor categorization';


--
-- Name: COLUMN tenant_disciplines.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_disciplines.key IS 'Machine key for discipline (engineering, design, etc.)';


--
-- Name: COLUMN tenant_disciplines.display_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_disciplines.display_name IS 'Human-readable discipline name';


--
-- Name: COLUMN tenant_disciplines.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_disciplines.active IS 'Soft-disable; inactive disciplines hidden from UI but preserved for historical data';


--
-- Name: tenant_labor_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_labor_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    key text NOT NULL,
    title text NOT NULL,
    discipline_key text NOT NULL,
    description text,
    soc_code text,
    education text,
    levels jsonb,
    default_hours_per_month numeric(6,2) DEFAULT 160,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE tenant_labor_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_labor_categories IS 'Tenant-scoped labor catalog with salary levels/steps';


--
-- Name: COLUMN tenant_labor_categories.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_labor_categories.key IS 'Machine key for category (backend_developer, product_manager, etc.)';


--
-- Name: COLUMN tenant_labor_categories.discipline_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_labor_categories.discipline_key IS 'References tenant_disciplines.key for this tenant';


--
-- Name: COLUMN tenant_labor_categories.levels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_labor_categories.levels IS 'JSONB: { "levels": [{ "level": "IC1", "level_title": "Associate", "steps": [87000, 89610] }] }. NULL = needs-setup.';


--
-- Name: COLUMN tenant_labor_categories.row_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_labor_categories.row_version IS 'Optimistic concurrency control';


--
-- Name: tenant_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'estimator'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    invited_by uuid,
    CONSTRAINT tenant_memberships_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text, 'writer'::text, 'reviewer'::text, 'accountant'::text]))),
    CONSTRAINT tenant_memberships_status_check CHECK ((status = ANY (ARRAY['active'::text, 'invited'::text, 'suspended'::text])))
);


--
-- Name: TABLE tenant_memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_memberships IS 'User-tenant relationships with role-based permissions';


--
-- Name: COLUMN tenant_memberships.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_memberships.role IS 'owner=full control, admin=manage users, estimator=pricing work, writer=proposal text, reviewer=approvals, accountant=rates';


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tenants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text])))
);


--
-- Name: TABLE tenants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenants IS 'Multi-tenancy root: each tenant is an organization with isolated data';


--
-- Name: wbs_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wbs_elements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid,
    wbs_number text NOT NULL,
    title text NOT NULL,
    sow_reference text,
    why text,
    what text,
    not_included text,
    assumptions text[],
    estimate_method text DEFAULT 'engineering'::text,
    confidence text DEFAULT 'medium'::text,
    labor_estimates jsonb DEFAULT '[]'::jsonb,
    linked_requirement_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: wbs_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wbs_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    wbs_element_id text,
    is_new_element boolean DEFAULT false,
    proposed_title text,
    proposed_hours jsonb DEFAULT '{}'::jsonb,
    proposed_roles jsonb DEFAULT '[]'::jsonb,
    proposed_estimation_method text,
    proposed_assumptions text,
    proposed_notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewer_comment text,
    owner_response text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT wbs_submissions_proposed_estimation_method_check CHECK ((proposed_estimation_method = ANY (ARRAY['engineering'::text, 'parametric'::text, 'historical'::text, NULL::text]))),
    CONSTRAINT wbs_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'modified'::text, 'rejected'::text])))
);


--
-- Name: wbs_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wbs_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    wbs_version_id uuid NOT NULL,
    parent_task_id uuid,
    wbs_code text NOT NULL,
    title text NOT NULL,
    description text,
    deliverable text,
    sow_reference text,
    start_month integer,
    end_month integer,
    sort_order integer DEFAULT 0 NOT NULL,
    source public.wbs_task_source DEFAULT 'generated'::public.wbs_task_source NOT NULL,
    user_modified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    row_version integer DEFAULT 1 NOT NULL,
    notes_jsonb jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT valid_month_range CHECK (((start_month IS NULL) OR (end_month IS NULL) OR (end_month >= start_month))),
    CONSTRAINT wbs_tasks_end_month_check CHECK (((end_month IS NULL) OR (end_month >= 1))),
    CONSTRAINT wbs_tasks_start_month_check CHECK (((start_month IS NULL) OR (start_month >= 1)))
);


--
-- Name: TABLE wbs_tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.wbs_tasks IS 'Normalized WBS elements with hierarchical structure';


--
-- Name: COLUMN wbs_tasks.parent_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_tasks.parent_task_id IS 'Optional parent for nested WBS structure';


--
-- Name: COLUMN wbs_tasks.wbs_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_tasks.wbs_code IS 'WBS code like "1.2.3" for hierarchical numbering';


--
-- Name: COLUMN wbs_tasks.start_month; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_tasks.start_month IS 'Start month (cumulative contract months, 1-indexed)';


--
-- Name: COLUMN wbs_tasks.end_month; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_tasks.end_month IS 'End month (cumulative contract months, 1-indexed)';


--
-- Name: COLUMN wbs_tasks.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_tasks.source IS 'generated = from AI, user_added = manually created';


--
-- Name: COLUMN wbs_tasks.user_modified; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_tasks.user_modified IS 'True if user has edited a generated task';


--
-- Name: COLUMN wbs_tasks.notes_jsonb; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_tasks.notes_jsonb IS 'BOE-critical fields: basisOfEstimate, assumptions, why, notIncluded, dependencies';


--
-- Name: wbs_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wbs_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    intelligence_version_id uuid NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    status public.wbs_status DEFAULT 'generated_candidate'::public.wbs_status NOT NULL,
    based_on_wbs_version_id uuid,
    generation_job_note text,
    created_at timestamp with time zone DEFAULT now(),
    activated_at timestamp with time zone,
    superseded_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    row_version integer DEFAULT 1 NOT NULL,
    CONSTRAINT activated_at_required_when_active CHECK (((status <> 'active'::public.wbs_status) OR (activated_at IS NOT NULL))),
    CONSTRAINT superseded_at_required_when_superseded CHECK (((status <> 'superseded'::public.wbs_status) OR (superseded_at IS NOT NULL)))
);


--
-- Name: TABLE wbs_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.wbs_versions IS 'Versioned WBS with candidate-accept flow; one active per proposal';


--
-- Name: COLUMN wbs_versions.intelligence_version_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_versions.intelligence_version_id IS 'Gate: confirmed intelligence required for generated_candidate or active status';


--
-- Name: COLUMN wbs_versions.based_on_wbs_version_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_versions.based_on_wbs_version_id IS 'Lineage tracking for derived versions';


--
-- Name: COLUMN wbs_versions.generation_job_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wbs_versions.generation_job_note IS 'Model/prompt identifiers for generation traceability';


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    selected_columns text[],
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: backfill_rate_snapshot backfill_rate_snapshot_assignment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backfill_rate_snapshot
    ADD CONSTRAINT backfill_rate_snapshot_assignment_id_key UNIQUE (assignment_id);


--
-- Name: backfill_rate_snapshot backfill_rate_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backfill_rate_snapshot
    ADD CONSTRAINT backfill_rate_snapshot_pkey PRIMARY KEY (id);


--
-- Name: boe_share_links boe_share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boe_share_links
    ADD CONSTRAINT boe_share_links_pkey PRIMARY KEY (id);


--
-- Name: boe_share_links boe_share_links_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boe_share_links
    ADD CONSTRAINT boe_share_links_token_key UNIQUE (token);


--
-- Name: collab_section_links collab_section_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_section_links
    ADD CONSTRAINT collab_section_links_pkey PRIMARY KEY (id);


--
-- Name: collab_section_links collab_section_links_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_section_links
    ADD CONSTRAINT collab_section_links_token_key UNIQUE (token);


--
-- Name: collab_sessions collab_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_sessions
    ADD CONSTRAINT collab_sessions_pkey PRIMARY KEY (id);


--
-- Name: collab_sessions collab_sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_sessions
    ADD CONSTRAINT collab_sessions_token_key UNIQUE (token);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_roles company_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_roles
    ADD CONSTRAINT company_roles_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_company_id_key UNIQUE (company_id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: compliance_items compliance_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_items
    ADD CONSTRAINT compliance_items_pkey PRIMARY KEY (id);


--
-- Name: content_library content_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_library
    ADD CONSTRAINT content_library_pkey PRIMARY KEY (id);


--
-- Name: gsa_rates gsa_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gsa_rates
    ADD CONSTRAINT gsa_rates_pkey PRIMARY KEY (id);


--
-- Name: intelligence_disciplines intelligence_disciplines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_disciplines
    ADD CONSTRAINT intelligence_disciplines_pkey PRIMARY KEY (id);


--
-- Name: intelligence_labor_requirements intelligence_labor_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_labor_requirements
    ADD CONSTRAINT intelligence_labor_requirements_pkey PRIMARY KEY (id);


--
-- Name: intelligence_periods intelligence_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_periods
    ADD CONSTRAINT intelligence_periods_pkey PRIMARY KEY (id);


--
-- Name: intelligence_versions intelligence_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_versions
    ADD CONSTRAINT intelligence_versions_pkey PRIMARY KEY (id);


--
-- Name: labor_category_aliases labor_category_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_category_aliases
    ADD CONSTRAINT labor_category_aliases_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: proposal_sections proposal_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_sections
    ADD CONSTRAINT proposal_sections_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: requirements requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_pkey PRIMARY KEY (id);


--
-- Name: section_coaching section_coaching_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_coaching
    ADD CONSTRAINT section_coaching_pkey PRIMARY KEY (id);


--
-- Name: section_coaching section_coaching_proposal_section_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_coaching
    ADD CONSTRAINT section_coaching_proposal_section_unique UNIQUE (proposal_id, section_id);


--
-- Name: solicitation_documents solicitation_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitation_documents
    ADD CONSTRAINT solicitation_documents_pkey PRIMARY KEY (id);


--
-- Name: staffing_assignments staffing_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffing_assignments
    ADD CONSTRAINT staffing_assignments_pkey PRIMARY KEY (id);


--
-- Name: tenant_disciplines tenant_disciplines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_disciplines
    ADD CONSTRAINT tenant_disciplines_pkey PRIMARY KEY (id);


--
-- Name: tenant_labor_categories tenant_labor_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_labor_categories
    ADD CONSTRAINT tenant_labor_categories_pkey PRIMARY KEY (id);


--
-- Name: tenant_memberships tenant_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_pkey PRIMARY KEY (id);


--
-- Name: tenant_memberships tenant_memberships_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_tenant_id_user_id_key UNIQUE (tenant_id, user_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: labor_category_aliases unique_alias_per_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_category_aliases
    ADD CONSTRAINT unique_alias_per_category UNIQUE (labor_category_id, alias);


--
-- Name: tenant_disciplines unique_discipline_per_tenant; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_disciplines
    ADD CONSTRAINT unique_discipline_per_tenant UNIQUE (tenant_id, key);


--
-- Name: intelligence_disciplines unique_discipline_per_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_disciplines
    ADD CONSTRAINT unique_discipline_per_version UNIQUE (version_id, discipline);


--
-- Name: tenant_labor_categories unique_labor_category_per_tenant; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_labor_categories
    ADD CONSTRAINT unique_labor_category_per_tenant UNIQUE (tenant_id, key);


--
-- Name: solicitation_documents unique_storage_path; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitation_documents
    ADD CONSTRAINT unique_storage_path UNIQUE (storage_path);


--
-- Name: intelligence_versions unique_version_per_proposal; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_versions
    ADD CONSTRAINT unique_version_per_proposal UNIQUE (proposal_id, version_number);


--
-- Name: wbs_versions unique_wbs_version_per_proposal; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_versions
    ADD CONSTRAINT unique_wbs_version_per_proposal UNIQUE (proposal_id, version_number);


--
-- Name: wbs_elements wbs_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_elements
    ADD CONSTRAINT wbs_elements_pkey PRIMARY KEY (id);


--
-- Name: wbs_submissions wbs_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_submissions
    ADD CONSTRAINT wbs_submissions_pkey PRIMARY KEY (id);


--
-- Name: wbs_tasks wbs_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_tasks
    ADD CONSTRAINT wbs_tasks_pkey PRIMARY KEY (id);


--
-- Name: wbs_versions wbs_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_versions
    ADD CONSTRAINT wbs_versions_pkey PRIMARY KEY (id);


--
-- Name: messages messages_payload_exclusive; Type: CHECK CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages
    ADD CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL))) NOT VALID;


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_actor ON public.audit_events USING btree (tenant_id, actor_type, actor_id, created_at DESC);


--
-- Name: idx_audit_aggregate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_aggregate ON public.audit_events USING btree (aggregate_type, aggregate_id, created_at DESC);


--
-- Name: idx_audit_command; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_command ON public.audit_events USING btree (tenant_id, command_name, created_at DESC);


--
-- Name: idx_audit_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_correlation ON public.audit_events USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);


--
-- Name: idx_audit_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_tenant ON public.audit_events USING btree (tenant_id, created_at DESC);


--
-- Name: idx_boe_share_links_proposal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boe_share_links_proposal_id ON public.boe_share_links USING btree (proposal_id);


--
-- Name: idx_boe_share_links_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boe_share_links_token ON public.boe_share_links USING btree (token);


--
-- Name: idx_coaching_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaching_section ON public.section_coaching USING btree (section_id);


--
-- Name: idx_collab_section_links_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_section_links_proposal ON public.collab_section_links USING btree (proposal_id);


--
-- Name: idx_collab_section_links_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_section_links_token ON public.collab_section_links USING btree (token);


--
-- Name: idx_collab_sessions_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_sessions_proposal ON public.collab_sessions USING btree (proposal_id);


--
-- Name: idx_collab_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_sessions_token ON public.collab_sessions USING btree (token);


--
-- Name: idx_companies_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_companies_owner ON public.companies USING btree (owner_id);


--
-- Name: idx_company_roles_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_roles_company ON public.company_roles USING btree (company_id);


--
-- Name: idx_company_settings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_settings_tenant ON public.company_settings USING btree (tenant_id);


--
-- Name: idx_compliance_items_proposal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_items_proposal_id ON public.compliance_items USING btree (proposal_id);


--
-- Name: idx_content_library_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_company ON public.content_library USING btree (company_id);


--
-- Name: idx_content_library_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_type ON public.content_library USING btree (company_id, type);


--
-- Name: idx_gsa_rates_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gsa_rates_company ON public.gsa_rates USING btree (company_id);


--
-- Name: idx_intelligence_disciplines_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_disciplines_version ON public.intelligence_disciplines USING btree (version_id);


--
-- Name: idx_intelligence_labor_reqs_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_labor_reqs_title ON public.intelligence_labor_requirements USING btree (version_id, title);


--
-- Name: idx_intelligence_labor_reqs_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_labor_reqs_version ON public.intelligence_labor_requirements USING btree (version_id);


--
-- Name: idx_intelligence_periods_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_periods_sort ON public.intelligence_periods USING btree (version_id, sort_order);


--
-- Name: idx_intelligence_periods_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_periods_version ON public.intelligence_periods USING btree (version_id);


--
-- Name: idx_intelligence_versions_doc_set; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_versions_doc_set ON public.intelligence_versions USING btree (proposal_id, document_set_hash);


--
-- Name: idx_intelligence_versions_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_versions_proposal ON public.intelligence_versions USING btree (proposal_id);


--
-- Name: idx_intelligence_versions_proposal_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_versions_proposal_status ON public.intelligence_versions USING btree (proposal_id, status);


--
-- Name: idx_intelligence_versions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_versions_status ON public.intelligence_versions USING btree (status);


--
-- Name: idx_intelligence_versions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intelligence_versions_tenant ON public.intelligence_versions USING btree (tenant_id);


--
-- Name: idx_labor_aliases_alias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_aliases_alias ON public.labor_category_aliases USING btree (alias);


--
-- Name: idx_labor_aliases_alias_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_aliases_alias_lower ON public.labor_category_aliases USING btree (lower(alias));


--
-- Name: idx_labor_aliases_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_aliases_category ON public.labor_category_aliases USING btree (labor_category_id);


--
-- Name: idx_labor_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_categories_active ON public.tenant_labor_categories USING btree (tenant_id, active) WHERE (active = true);


--
-- Name: idx_labor_categories_discipline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_categories_discipline ON public.tenant_labor_categories USING btree (tenant_id, discipline_key);


--
-- Name: idx_labor_categories_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_categories_tenant ON public.tenant_labor_categories USING btree (tenant_id);


--
-- Name: idx_labor_categories_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_categories_title ON public.tenant_labor_categories USING btree (tenant_id, title);


--
-- Name: idx_labor_reqs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_reqs_category ON public.intelligence_labor_requirements USING btree (labor_category_id);


--
-- Name: idx_labor_reqs_prescribed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_reqs_prescribed ON public.intelligence_labor_requirements USING btree (version_id, is_prescribed) WHERE (is_prescribed = true);


--
-- Name: idx_labor_reqs_unmapped; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_reqs_unmapped ON public.intelligence_labor_requirements USING btree (version_id) WHERE (labor_category_id IS NULL);


--
-- Name: idx_memberships_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_role ON public.tenant_memberships USING btree (tenant_id, role);


--
-- Name: idx_memberships_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_tenant ON public.tenant_memberships USING btree (tenant_id);


--
-- Name: idx_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_user ON public.tenant_memberships USING btree (user_id);


--
-- Name: idx_notifications_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_company ON public.notifications USING btree (company_id, read, created_at DESC);


--
-- Name: idx_one_active_wbs_per_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_one_active_wbs_per_proposal ON public.wbs_versions USING btree (proposal_id) WHERE (status = 'active'::public.wbs_status);


--
-- Name: idx_proposal_sections_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_sections_parent ON public.proposal_sections USING btree (parent_id);


--
-- Name: idx_proposal_sections_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_sections_proposal ON public.proposal_sections USING btree (proposal_id);


--
-- Name: idx_proposal_sections_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_sections_sort ON public.proposal_sections USING btree (proposal_id, parent_id, sort_order);


--
-- Name: idx_proposals_active_intelligence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_active_intelligence ON public.proposals USING btree (active_intelligence_version_id) WHERE (active_intelligence_version_id IS NOT NULL);


--
-- Name: idx_proposals_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_company ON public.proposals USING btree (company_id);


--
-- Name: idx_proposals_row_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_row_version ON public.proposals USING btree (id, row_version);


--
-- Name: idx_requirements_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirements_proposal ON public.requirements USING btree (proposal_id);


--
-- Name: idx_snapshot_discrepancy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snapshot_discrepancy ON public.backfill_rate_snapshot USING btree (discrepancy_cents) WHERE (discrepancy_cents <> 0);


--
-- Name: idx_snapshot_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snapshot_review ON public.backfill_rate_snapshot USING btree (requires_manual_review) WHERE (requires_manual_review = true);


--
-- Name: idx_sol_docs_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sol_docs_proposal ON public.solicitation_documents USING btree (proposal_id);


--
-- Name: idx_sol_docs_proposal_precedence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sol_docs_proposal_precedence ON public.solicitation_documents USING btree (proposal_id, precedence_rank DESC);


--
-- Name: idx_sol_docs_proposal_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sol_docs_proposal_type ON public.solicitation_documents USING btree (proposal_id, doc_type);


--
-- Name: idx_sol_docs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sol_docs_status ON public.solicitation_documents USING btree (status);


--
-- Name: idx_sol_docs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sol_docs_tenant ON public.solicitation_documents USING btree (tenant_id);


--
-- Name: idx_staffing_discipline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staffing_discipline ON public.staffing_assignments USING btree (discipline);


--
-- Name: idx_staffing_labor_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staffing_labor_category ON public.staffing_assignments USING btree (labor_category_id);


--
-- Name: idx_staffing_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staffing_period ON public.staffing_assignments USING btree (period_label);


--
-- Name: idx_staffing_rate_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staffing_rate_source ON public.staffing_assignments USING btree (rate_source);


--
-- Name: idx_staffing_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staffing_role ON public.staffing_assignments USING btree (role_title);


--
-- Name: idx_staffing_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staffing_task ON public.staffing_assignments USING btree (wbs_task_id);


--
-- Name: idx_staffing_task_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staffing_task_role ON public.staffing_assignments USING btree (wbs_task_id, role_title);


--
-- Name: idx_tenant_disciplines_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_disciplines_active ON public.tenant_disciplines USING btree (tenant_id, active) WHERE (active = true);


--
-- Name: idx_tenant_disciplines_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_disciplines_key ON public.tenant_disciplines USING btree (tenant_id, key);


--
-- Name: idx_tenant_disciplines_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_disciplines_tenant ON public.tenant_disciplines USING btree (tenant_id);


--
-- Name: idx_tenants_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_company ON public.tenants USING btree (company_id);


--
-- Name: idx_tenants_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_slug ON public.tenants USING btree (slug);


--
-- Name: idx_tenants_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_status ON public.tenants USING btree (status);


--
-- Name: idx_wbs_elements_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_elements_proposal ON public.wbs_elements USING btree (proposal_id);


--
-- Name: idx_wbs_submissions_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_submissions_session ON public.wbs_submissions USING btree (session_id);


--
-- Name: idx_wbs_submissions_wbs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_submissions_wbs ON public.wbs_submissions USING btree (wbs_element_id);


--
-- Name: idx_wbs_tasks_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_tasks_code ON public.wbs_tasks USING btree (wbs_version_id, wbs_code);


--
-- Name: idx_wbs_tasks_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_tasks_parent ON public.wbs_tasks USING btree (parent_task_id);


--
-- Name: idx_wbs_tasks_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_tasks_sort ON public.wbs_tasks USING btree (wbs_version_id, sort_order);


--
-- Name: idx_wbs_tasks_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_tasks_version ON public.wbs_tasks USING btree (wbs_version_id);


--
-- Name: idx_wbs_versions_intelligence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_versions_intelligence ON public.wbs_versions USING btree (intelligence_version_id);


--
-- Name: idx_wbs_versions_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_versions_proposal ON public.wbs_versions USING btree (proposal_id);


--
-- Name: idx_wbs_versions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_versions_status ON public.wbs_versions USING btree (status);


--
-- Name: idx_wbs_versions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wbs_versions_tenant ON public.wbs_versions USING btree (tenant_id);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_selec; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_selec ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter, COALESCE(selected_columns, '{}'::text[]));


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: proposals enforce_active_intelligence_version_ownership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_active_intelligence_version_ownership BEFORE INSERT OR UPDATE OF active_intelligence_version_id ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.check_active_intelligence_version_ownership();


--
-- Name: intelligence_disciplines enforce_discipline_parent_draft; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_discipline_parent_draft BEFORE INSERT OR DELETE OR UPDATE ON public.intelligence_disciplines FOR EACH ROW EXECUTE FUNCTION public.check_fact_table_parent_draft();


--
-- Name: intelligence_versions enforce_intelligence_version_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_intelligence_version_immutability BEFORE UPDATE ON public.intelligence_versions FOR EACH ROW EXECUTE FUNCTION public.check_intelligence_version_immutability();


--
-- Name: intelligence_versions enforce_intelligence_version_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_intelligence_version_no_delete BEFORE DELETE ON public.intelligence_versions FOR EACH ROW EXECUTE FUNCTION public.check_intelligence_version_delete();


--
-- Name: intelligence_labor_requirements enforce_labor_req_parent_draft; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_labor_req_parent_draft BEFORE INSERT OR DELETE OR UPDATE ON public.intelligence_labor_requirements FOR EACH ROW EXECUTE FUNCTION public.check_fact_table_parent_draft();


--
-- Name: intelligence_periods enforce_period_parent_draft; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_period_parent_draft BEFORE INSERT OR DELETE OR UPDATE ON public.intelligence_periods FOR EACH ROW EXECUTE FUNCTION public.check_fact_table_parent_draft();


--
-- Name: intelligence_labor_requirements intelligence_labor_reqs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intelligence_labor_reqs_updated_at BEFORE UPDATE ON public.intelligence_labor_requirements FOR EACH ROW EXECUTE FUNCTION public.update_intelligence_versions_timestamp();


--
-- Name: intelligence_periods intelligence_periods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intelligence_periods_updated_at BEFORE UPDATE ON public.intelligence_periods FOR EACH ROW EXECUTE FUNCTION public.update_intelligence_versions_timestamp();


--
-- Name: intelligence_versions intelligence_versions_row_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intelligence_versions_row_version BEFORE UPDATE ON public.intelligence_versions FOR EACH ROW EXECUTE FUNCTION public.increment_row_version();


--
-- Name: intelligence_versions intelligence_versions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intelligence_versions_updated_at BEFORE UPDATE ON public.intelligence_versions FOR EACH ROW EXECUTE FUNCTION public.update_intelligence_versions_timestamp();


--
-- Name: proposals proposals_row_version_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proposals_row_version_trigger BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.increment_row_version();


--
-- Name: staffing_assignments staffing_assignments_row_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staffing_assignments_row_version BEFORE UPDATE ON public.staffing_assignments FOR EACH ROW EXECUTE FUNCTION public.increment_row_version();


--
-- Name: staffing_assignments staffing_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staffing_assignments_updated_at BEFORE UPDATE ON public.staffing_assignments FOR EACH ROW EXECUTE FUNCTION public.v_update_staffing_assignments_timestamp();


--
-- Name: staffing_assignments staffing_block_superseded_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staffing_block_superseded_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.staffing_assignments FOR EACH ROW EXECUTE FUNCTION public.v_block_child_mutation_on_superseded();


--
-- Name: tenant_disciplines tenant_disciplines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_disciplines_updated_at BEFORE UPDATE ON public.tenant_disciplines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_labor_categories tenant_labor_categories_row_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_labor_categories_row_version BEFORE UPDATE ON public.tenant_labor_categories FOR EACH ROW EXECUTE FUNCTION public.increment_row_version();


--
-- Name: tenant_labor_categories tenant_labor_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_labor_categories_updated_at BEFORE UPDATE ON public.tenant_labor_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: solicitation_documents trg_set_default_precedence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_default_precedence BEFORE INSERT ON public.solicitation_documents FOR EACH ROW EXECUTE FUNCTION public.set_default_precedence();


--
-- Name: solicitation_documents trg_solicitation_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_solicitation_documents_updated_at BEFORE UPDATE ON public.solicitation_documents FOR EACH ROW EXECUTE FUNCTION public.update_solicitation_documents_updated_at();


--
-- Name: proposal_sections trigger_proposal_sections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_proposal_sections_updated_at BEFORE UPDATE ON public.proposal_sections FOR EACH ROW EXECUTE FUNCTION public.update_proposal_sections_updated_at();


--
-- Name: compliance_items update_compliance_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_compliance_items_updated_at BEFORE UPDATE ON public.compliance_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_labor_categories validate_labor_category_levels_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_labor_category_levels_trigger BEFORE INSERT OR UPDATE ON public.tenant_labor_categories FOR EACH ROW EXECUTE FUNCTION public.validate_labor_category_levels();


--
-- Name: wbs_tasks wbs_tasks_block_superseded_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wbs_tasks_block_superseded_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.wbs_tasks FOR EACH ROW EXECUTE FUNCTION public.v_block_child_mutation_on_superseded();


--
-- Name: wbs_tasks wbs_tasks_row_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wbs_tasks_row_version BEFORE UPDATE ON public.wbs_tasks FOR EACH ROW EXECUTE FUNCTION public.increment_row_version();


--
-- Name: wbs_tasks wbs_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wbs_tasks_updated_at BEFORE UPDATE ON public.wbs_tasks FOR EACH ROW EXECUTE FUNCTION public.v_update_wbs_tasks_timestamp();


--
-- Name: wbs_versions wbs_versions_block_active_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wbs_versions_block_active_delete BEFORE DELETE ON public.wbs_versions FOR EACH ROW EXECUTE FUNCTION public.v_block_active_wbs_delete();


--
-- Name: wbs_versions wbs_versions_block_superseded_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wbs_versions_block_superseded_update BEFORE UPDATE ON public.wbs_versions FOR EACH ROW EXECUTE FUNCTION public.v_block_superseded_wbs_mutation();


--
-- Name: wbs_versions wbs_versions_intelligence_gate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wbs_versions_intelligence_gate BEFORE INSERT OR UPDATE ON public.wbs_versions FOR EACH ROW EXECUTE FUNCTION public.v_enforce_intelligence_gate();


--
-- Name: wbs_versions wbs_versions_row_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wbs_versions_row_version BEFORE UPDATE ON public.wbs_versions FOR EACH ROW EXECUTE FUNCTION public.increment_row_version();


--
-- Name: wbs_versions wbs_versions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wbs_versions_updated_at BEFORE UPDATE ON public.wbs_versions FOR EACH ROW EXECUTE FUNCTION public.v_update_wbs_versions_timestamp();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audit_events audit_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: backfill_rate_snapshot backfill_rate_snapshot_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backfill_rate_snapshot
    ADD CONSTRAINT backfill_rate_snapshot_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.staffing_assignments(id) ON DELETE CASCADE;


--
-- Name: backfill_rate_snapshot backfill_rate_snapshot_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backfill_rate_snapshot
    ADD CONSTRAINT backfill_rate_snapshot_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: backfill_rate_snapshot backfill_rate_snapshot_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backfill_rate_snapshot
    ADD CONSTRAINT backfill_rate_snapshot_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: boe_share_links boe_share_links_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boe_share_links
    ADD CONSTRAINT boe_share_links_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: collab_section_links collab_section_links_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_section_links
    ADD CONSTRAINT collab_section_links_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: collab_section_links collab_section_links_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_section_links
    ADD CONSTRAINT collab_section_links_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: collab_sessions collab_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_sessions
    ADD CONSTRAINT collab_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: collab_sessions collab_sessions_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_sessions
    ADD CONSTRAINT collab_sessions_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: companies companies_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: company_roles company_roles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_roles
    ADD CONSTRAINT company_roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_settings company_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_settings company_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: compliance_items compliance_items_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_items
    ADD CONSTRAINT compliance_items_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: compliance_items compliance_items_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_items
    ADD CONSTRAINT compliance_items_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON DELETE SET NULL;


--
-- Name: content_library content_library_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_library
    ADD CONSTRAINT content_library_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: content_library content_library_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_library
    ADD CONSTRAINT content_library_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: gsa_rates gsa_rates_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gsa_rates
    ADD CONSTRAINT gsa_rates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: intelligence_disciplines intelligence_disciplines_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_disciplines
    ADD CONSTRAINT intelligence_disciplines_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.intelligence_versions(id) ON DELETE CASCADE;


--
-- Name: intelligence_labor_requirements intelligence_labor_requirements_labor_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_labor_requirements
    ADD CONSTRAINT intelligence_labor_requirements_labor_category_id_fkey FOREIGN KEY (labor_category_id) REFERENCES public.tenant_labor_categories(id) ON DELETE SET NULL;


--
-- Name: intelligence_labor_requirements intelligence_labor_requirements_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_labor_requirements
    ADD CONSTRAINT intelligence_labor_requirements_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.intelligence_versions(id) ON DELETE CASCADE;


--
-- Name: intelligence_periods intelligence_periods_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_periods
    ADD CONSTRAINT intelligence_periods_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.intelligence_versions(id) ON DELETE CASCADE;


--
-- Name: intelligence_versions intelligence_versions_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_versions
    ADD CONSTRAINT intelligence_versions_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: intelligence_versions intelligence_versions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_versions
    ADD CONSTRAINT intelligence_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: labor_category_aliases labor_category_aliases_labor_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_category_aliases
    ADD CONSTRAINT labor_category_aliases_labor_category_id_fkey FOREIGN KEY (labor_category_id) REFERENCES public.tenant_labor_categories(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: proposal_sections proposal_sections_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_sections
    ADD CONSTRAINT proposal_sections_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.proposal_sections(id) ON DELETE CASCADE;


--
-- Name: proposal_sections proposal_sections_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_sections
    ADD CONSTRAINT proposal_sections_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_active_intelligence_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_active_intelligence_version_id_fkey FOREIGN KEY (active_intelligence_version_id) REFERENCES public.intelligence_versions(id) ON DELETE SET NULL;


--
-- Name: proposals proposals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: requirements requirements_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: section_coaching section_coaching_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_coaching
    ADD CONSTRAINT section_coaching_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: solicitation_documents solicitation_documents_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitation_documents
    ADD CONSTRAINT solicitation_documents_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: solicitation_documents solicitation_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitation_documents
    ADD CONSTRAINT solicitation_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: staffing_assignments staffing_assignments_labor_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffing_assignments
    ADD CONSTRAINT staffing_assignments_labor_category_id_fkey FOREIGN KEY (labor_category_id) REFERENCES public.tenant_labor_categories(id) ON DELETE SET NULL;


--
-- Name: staffing_assignments staffing_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffing_assignments
    ADD CONSTRAINT staffing_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: staffing_assignments staffing_assignments_wbs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffing_assignments
    ADD CONSTRAINT staffing_assignments_wbs_task_id_fkey FOREIGN KEY (wbs_task_id) REFERENCES public.wbs_tasks(id) ON DELETE CASCADE;


--
-- Name: tenant_disciplines tenant_disciplines_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_disciplines
    ADD CONSTRAINT tenant_disciplines_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_labor_categories tenant_labor_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_labor_categories
    ADD CONSTRAINT tenant_labor_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_memberships tenant_memberships_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: tenant_memberships tenant_memberships_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_memberships tenant_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tenants tenants_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: tenants tenants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: wbs_elements wbs_elements_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_elements
    ADD CONSTRAINT wbs_elements_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: wbs_submissions wbs_submissions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_submissions
    ADD CONSTRAINT wbs_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: wbs_submissions wbs_submissions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_submissions
    ADD CONSTRAINT wbs_submissions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.collab_sessions(id) ON DELETE CASCADE;


--
-- Name: wbs_tasks wbs_tasks_parent_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_tasks
    ADD CONSTRAINT wbs_tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.wbs_tasks(id) ON DELETE CASCADE;


--
-- Name: wbs_tasks wbs_tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_tasks
    ADD CONSTRAINT wbs_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: wbs_tasks wbs_tasks_wbs_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_tasks
    ADD CONSTRAINT wbs_tasks_wbs_version_id_fkey FOREIGN KEY (wbs_version_id) REFERENCES public.wbs_versions(id) ON DELETE CASCADE;


--
-- Name: wbs_versions wbs_versions_based_on_wbs_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_versions
    ADD CONSTRAINT wbs_versions_based_on_wbs_version_id_fkey FOREIGN KEY (based_on_wbs_version_id) REFERENCES public.wbs_versions(id);


--
-- Name: wbs_versions wbs_versions_intelligence_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_versions
    ADD CONSTRAINT wbs_versions_intelligence_version_id_fkey FOREIGN KEY (intelligence_version_id) REFERENCES public.intelligence_versions(id);


--
-- Name: wbs_versions wbs_versions_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_versions
    ADD CONSTRAINT wbs_versions_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: wbs_versions wbs_versions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wbs_versions
    ADD CONSTRAINT wbs_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: labor_category_aliases Admin manage labor category aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage labor category aliases" ON public.labor_category_aliases TO authenticated USING (public.is_tenant_admin(public.get_labor_category_tenant(labor_category_id))) WITH CHECK (public.is_tenant_admin(public.get_labor_category_tenant(labor_category_id)));


--
-- Name: tenant_memberships Admin manage memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage memberships" ON public.tenant_memberships TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));


--
-- Name: tenant_disciplines Admin manage tenant disciplines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage tenant disciplines" ON public.tenant_disciplines TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));


--
-- Name: tenant_labor_categories Admin manage tenant labor categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage tenant labor categories" ON public.tenant_labor_categories TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));


--
-- Name: tenant_memberships Admin view all tenant memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin view all tenant memberships" ON public.tenant_memberships FOR SELECT TO authenticated USING (public.is_tenant_admin(tenant_id));


--
-- Name: compliance_items Authenticated users can manage compliance items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage compliance items" ON public.compliance_items TO authenticated USING (true) WITH CHECK (true);


--
-- Name: collab_section_links Company manages collab links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company manages collab links" ON public.collab_section_links TO authenticated USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid())))) WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: content_library Company members manage content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company members manage content" ON public.content_library USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: notifications Company reads own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company reads own notifications" ON public.notifications TO authenticated USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid())))) WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: intelligence_versions Estimators create intelligence versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators create intelligence versions" ON public.intelligence_versions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = intelligence_versions.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: wbs_versions Estimators create wbs versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators create wbs versions" ON public.wbs_versions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = wbs_versions.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: POLICY "Estimators create wbs versions" ON wbs_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Estimators create wbs versions" ON public.wbs_versions IS 'Owner/admin/estimator can create WBS versions';


--
-- Name: wbs_versions Estimators delete wbs versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators delete wbs versions" ON public.wbs_versions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = wbs_versions.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: POLICY "Estimators delete wbs versions" ON wbs_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Estimators delete wbs versions" ON public.wbs_versions IS 'Owner/admin/estimator can delete (trigger blocks active deletion)';


--
-- Name: intelligence_disciplines Estimators manage intelligence disciplines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators manage intelligence disciplines" ON public.intelligence_disciplines TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = public.get_intelligence_version_tenant(intelligence_disciplines.version_id)) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = public.get_intelligence_version_tenant(intelligence_disciplines.version_id)) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: intelligence_labor_requirements Estimators manage intelligence labor reqs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators manage intelligence labor reqs" ON public.intelligence_labor_requirements TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = public.get_intelligence_version_tenant(intelligence_labor_requirements.version_id)) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = public.get_intelligence_version_tenant(intelligence_labor_requirements.version_id)) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: intelligence_periods Estimators manage intelligence periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators manage intelligence periods" ON public.intelligence_periods TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = public.get_intelligence_version_tenant(intelligence_periods.version_id)) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = public.get_intelligence_version_tenant(intelligence_periods.version_id)) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: staffing_assignments Estimators manage staffing assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators manage staffing assignments" ON public.staffing_assignments TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = staffing_assignments.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = staffing_assignments.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: wbs_tasks Estimators manage wbs tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators manage wbs tasks" ON public.wbs_tasks TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = wbs_tasks.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = wbs_tasks.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: intelligence_versions Estimators update intelligence versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators update intelligence versions" ON public.intelligence_versions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = intelligence_versions.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = intelligence_versions.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: wbs_versions Estimators update wbs versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estimators update wbs versions" ON public.wbs_versions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = wbs_versions.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.tenant_id = wbs_versions.tenant_id) AND (tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text, 'estimator'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: POLICY "Estimators update wbs versions" ON wbs_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Estimators update wbs versions" ON public.wbs_versions IS 'Owner/admin/estimator can update (triggers enforce immutability)';


--
-- Name: intelligence_disciplines Members view intelligence disciplines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view intelligence disciplines" ON public.intelligence_disciplines FOR SELECT TO authenticated USING (public.is_tenant_member(public.get_intelligence_version_tenant(version_id)));


--
-- Name: intelligence_labor_requirements Members view intelligence labor reqs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view intelligence labor reqs" ON public.intelligence_labor_requirements FOR SELECT TO authenticated USING (public.is_tenant_member(public.get_intelligence_version_tenant(version_id)));


--
-- Name: intelligence_periods Members view intelligence periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view intelligence periods" ON public.intelligence_periods FOR SELECT TO authenticated USING (public.is_tenant_member(public.get_intelligence_version_tenant(version_id)));


--
-- Name: intelligence_versions Members view intelligence versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view intelligence versions" ON public.intelligence_versions FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: labor_category_aliases Members view labor category aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view labor category aliases" ON public.labor_category_aliases FOR SELECT TO authenticated USING (public.is_tenant_member(public.get_labor_category_tenant(labor_category_id)));


--
-- Name: tenants Members view own tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view own tenant" ON public.tenants FOR SELECT TO authenticated USING ((id IN ( SELECT tenant_memberships.tenant_id
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: staffing_assignments Members view staffing assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view staffing assignments" ON public.staffing_assignments FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenant_disciplines Members view tenant disciplines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view tenant disciplines" ON public.tenant_disciplines FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenant_labor_categories Members view tenant labor categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view tenant labor categories" ON public.tenant_labor_categories FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: wbs_tasks Members view wbs tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view wbs tasks" ON public.wbs_tasks FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: wbs_versions Members view wbs versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view wbs versions" ON public.wbs_versions FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: POLICY "Members view wbs versions" ON wbs_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Members view wbs versions" ON public.wbs_versions IS 'All tenant members can view WBS versions';


--
-- Name: gsa_rates Owner manages GSA rates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner manages GSA rates" ON public.gsa_rates USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: section_coaching Owner manages coaching; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner manages coaching" ON public.section_coaching TO authenticated USING ((proposal_id IN ( SELECT p.id
   FROM (public.proposals p
     JOIN public.companies c ON ((p.company_id = c.id)))
  WHERE (c.owner_id = auth.uid())))) WITH CHECK ((proposal_id IN ( SELECT p.id
   FROM (public.proposals p
     JOIN public.companies c ON ((p.company_id = c.id)))
  WHERE (c.owner_id = auth.uid()))));


--
-- Name: collab_sessions Owner manages collab sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner manages collab sessions" ON public.collab_sessions USING ((created_by = auth.uid()));


--
-- Name: wbs_submissions Owner manages submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner manages submissions" ON public.wbs_submissions USING ((session_id IN ( SELECT collab_sessions.id
   FROM public.collab_sessions
  WHERE (collab_sessions.created_by = auth.uid()))));


--
-- Name: audit_events Owner/admin read audit events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner/admin read audit events" ON public.audit_events FOR SELECT TO authenticated USING ((tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: tenants Owner/admin update tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner/admin update tenant" ON public.tenants FOR UPDATE TO authenticated USING ((id IN ( SELECT tenant_memberships.tenant_id
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (tenant_memberships.status = 'active'::text))))) WITH CHECK ((id IN ( SELECT tenant_memberships.tenant_id
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: audit_events System insert audit events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System insert audit events" ON public.audit_events FOR INSERT TO authenticated WITH CHECK ((tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM public.tenant_memberships
  WHERE ((tenant_memberships.user_id = auth.uid()) AND (tenant_memberships.status = 'active'::text)))));


--
-- Name: companies Users can create own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own company" ON public.companies FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: company_roles Users can create own company roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own company roles" ON public.company_roles FOR INSERT WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: company_settings Users can create own company settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own company settings" ON public.company_settings FOR INSERT WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: proposals Users can create own proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own proposals" ON public.proposals FOR INSERT WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: requirements Users can create own requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own requirements" ON public.requirements FOR INSERT WITH CHECK ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: wbs_elements Users can create own wbs elements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own wbs elements" ON public.wbs_elements FOR INSERT WITH CHECK ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: companies Users can delete own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own company" ON public.companies FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: company_roles Users can delete own company roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own company roles" ON public.company_roles FOR DELETE USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: proposals Users can delete own proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own proposals" ON public.proposals FOR DELETE USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: requirements Users can delete own requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own requirements" ON public.requirements FOR DELETE USING ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: wbs_elements Users can delete own wbs elements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own wbs elements" ON public.wbs_elements FOR DELETE USING ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: solicitation_documents Users can delete their tenant documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their tenant documents" ON public.solicitation_documents FOR DELETE USING ((tenant_id IN ( SELECT tm.tenant_id
   FROM public.tenant_memberships tm
  WHERE (tm.user_id = auth.uid()))));


--
-- Name: solicitation_documents Users can insert documents for their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert documents for their tenant" ON public.solicitation_documents FOR INSERT WITH CHECK ((tenant_id IN ( SELECT tm.tenant_id
   FROM public.tenant_memberships tm
  WHERE (tm.user_id = auth.uid()))));


--
-- Name: companies Users can insert own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own company" ON public.companies FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: company_roles Users can manage own company roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own company roles" ON public.company_roles USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: company_settings Users can manage own company settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own company settings" ON public.company_settings USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: proposals Users can manage own proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own proposals" ON public.proposals USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: requirements Users can manage own requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own requirements" ON public.requirements USING ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: wbs_elements Users can manage own wbs elements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own wbs elements" ON public.wbs_elements USING ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: boe_share_links Users can manage their own proposal share links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own proposal share links" ON public.boe_share_links USING ((EXISTS ( SELECT 1
   FROM (public.proposals p
     JOIN public.companies c ON ((p.company_id = c.id)))
  WHERE ((p.id = boe_share_links.proposal_id) AND (c.owner_id = auth.uid())))));


--
-- Name: companies Users can update own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own company" ON public.companies FOR UPDATE USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: company_roles Users can update own company roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own company roles" ON public.company_roles FOR UPDATE USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid())))) WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: company_settings Users can update own company settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own company settings" ON public.company_settings FOR UPDATE USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid())))) WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: proposals Users can update own proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own proposals" ON public.proposals FOR UPDATE USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid())))) WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: requirements Users can update own requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own requirements" ON public.requirements FOR UPDATE USING ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid())))))) WITH CHECK ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: wbs_elements Users can update own wbs elements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own wbs elements" ON public.wbs_elements FOR UPDATE USING ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid())))))) WITH CHECK ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: solicitation_documents Users can update their tenant documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their tenant documents" ON public.solicitation_documents FOR UPDATE USING ((tenant_id IN ( SELECT tm.tenant_id
   FROM public.tenant_memberships tm
  WHERE (tm.user_id = auth.uid()))));


--
-- Name: companies Users can view own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own company" ON public.companies FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: company_roles Users can view own company roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own company roles" ON public.company_roles FOR SELECT USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: company_settings Users can view own company settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own company settings" ON public.company_settings FOR SELECT USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: proposals Users can view own proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own proposals" ON public.proposals FOR SELECT USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid()))));


--
-- Name: requirements Users can view own requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own requirements" ON public.requirements FOR SELECT USING ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: wbs_elements Users can view own wbs elements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own wbs elements" ON public.wbs_elements FOR SELECT USING ((proposal_id IN ( SELECT proposals.id
   FROM public.proposals
  WHERE (proposals.company_id IN ( SELECT companies.id
           FROM public.companies
          WHERE (companies.owner_id = auth.uid()))))));


--
-- Name: solicitation_documents Users can view their tenant documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their tenant documents" ON public.solicitation_documents FOR SELECT USING ((tenant_id IN ( SELECT tm.tenant_id
   FROM public.tenant_memberships tm
  WHERE (tm.user_id = auth.uid()))));


--
-- Name: proposal_sections Users manage their proposal sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their proposal sections" ON public.proposal_sections USING ((proposal_id IN ( SELECT p.id
   FROM (public.proposals p
     JOIN public.companies c ON ((p.company_id = c.id)))
  WHERE (c.owner_id = auth.uid()))));


--
-- Name: tenant_memberships Users view own membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own membership" ON public.tenant_memberships FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: boe_share_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boe_share_links ENABLE ROW LEVEL SECURITY;

--
-- Name: collab_section_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collab_section_links ENABLE ROW LEVEL SECURITY;

--
-- Name: collab_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collab_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: company_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: company_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;

--
-- Name: content_library; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;

--
-- Name: gsa_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gsa_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: intelligence_disciplines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intelligence_disciplines ENABLE ROW LEVEL SECURITY;

--
-- Name: intelligence_labor_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intelligence_labor_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: intelligence_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intelligence_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: intelligence_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intelligence_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: labor_category_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.labor_category_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposal_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: section_coaching; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.section_coaching ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitation_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitation_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: staffing_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staffing_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_disciplines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_disciplines ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_labor_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_labor_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: wbs_elements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wbs_elements ENABLE ROW LEVEL SECURITY;

--
-- Name: wbs_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wbs_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: wbs_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wbs_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: wbs_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wbs_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Allow authenticated deletes; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow authenticated deletes" ON storage.objects FOR DELETE TO authenticated USING ((bucket_id = 'avatars'::text));


--
-- Name: objects Allow authenticated uploads; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'avatars'::text));


--
-- Name: objects Allow authenticated uploads 1oj01fe_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow authenticated uploads 1oj01fe_0" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'avatars'::text));


--
-- Name: objects Allow public read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING ((bucket_id = 'avatars'::text));


--
-- Name: objects Allow public read 1oj01fe_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow public read 1oj01fe_0" ON storage.objects FOR SELECT USING (true);


--
-- Name: objects Allow users to delete own files 1oj01fe_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow users to delete own files 1oj01fe_0" ON storage.objects FOR DELETE TO authenticated USING (true);


--
-- Name: objects Allow users to delete own files 1oj01fe_1; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow users to delete own files 1oj01fe_1" ON storage.objects FOR SELECT TO authenticated USING (true);


--
-- Name: objects Public read access for solicitations; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for solicitations" ON storage.objects FOR SELECT USING ((bucket_id = 'solicitations'::text));


--
-- Name: objects Users can delete PDFs from their company folder; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete PDFs from their company folder" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'solicitations'::text) AND ((storage.foldername(name))[1] IN ( SELECT (companies.id)::text AS id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid())))));


--
-- Name: objects Users can read PDFs from their company folder; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can read PDFs from their company folder" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'solicitations'::text) AND ((storage.foldername(name))[1] IN ( SELECT (companies.id)::text AS id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid())))));


--
-- Name: objects Users can upload PDFs to their company folder; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload PDFs to their company folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'solicitations'::text) AND ((storage.foldername(name))[1] IN ( SELECT (companies.id)::text AS id
   FROM public.companies
  WHERE (companies.owner_id = auth.uid())))));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--


