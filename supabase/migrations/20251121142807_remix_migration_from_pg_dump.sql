CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: handbook_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handbook_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_key text NOT NULL,
    title_en text NOT NULL,
    title_pl text,
    title_uk text,
    title_ro text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: handbook_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handbook_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    employee_name text NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    signature_image text
);


--
-- Name: handbook_subsections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handbook_subsections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid NOT NULL,
    subsection_key text NOT NULL,
    title_en text NOT NULL,
    title_pl text,
    title_uk text,
    title_ro text,
    content_en text NOT NULL,
    content_pl text,
    content_uk text,
    content_ro text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_contact_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_contact_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_name text NOT NULL,
    contact_email text NOT NULL,
    contact_phone text,
    office_hours text,
    office_address text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: handbook_sections handbook_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_sections
    ADD CONSTRAINT handbook_sections_pkey PRIMARY KEY (id);


--
-- Name: handbook_sections handbook_sections_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_sections
    ADD CONSTRAINT handbook_sections_section_key_key UNIQUE (section_key);


--
-- Name: handbook_signatures handbook_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_signatures
    ADD CONSTRAINT handbook_signatures_pkey PRIMARY KEY (id);


--
-- Name: handbook_signatures handbook_signatures_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_signatures
    ADD CONSTRAINT handbook_signatures_user_id_key UNIQUE (user_id);


--
-- Name: handbook_subsections handbook_subsections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_subsections
    ADD CONSTRAINT handbook_subsections_pkey PRIMARY KEY (id);


--
-- Name: handbook_subsections handbook_subsections_section_id_subsection_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_subsections
    ADD CONSTRAINT handbook_subsections_section_id_subsection_key_key UNIQUE (section_id, subsection_key);


--
-- Name: hr_contact_settings hr_contact_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_contact_settings
    ADD CONSTRAINT hr_contact_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_handbook_signatures_signed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_handbook_signatures_signed_at ON public.handbook_signatures USING btree (signed_at DESC);


--
-- Name: idx_handbook_signatures_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_handbook_signatures_user_id ON public.handbook_signatures USING btree (user_id);


--
-- Name: handbook_sections update_handbook_sections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_handbook_sections_updated_at BEFORE UPDATE ON public.handbook_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: handbook_subsections update_handbook_subsections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_handbook_subsections_updated_at BEFORE UPDATE ON public.handbook_subsections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: hr_contact_settings update_hr_contact_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_hr_contact_settings_updated_at BEFORE UPDATE ON public.hr_contact_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: handbook_signatures handbook_signatures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_signatures
    ADD CONSTRAINT handbook_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: handbook_subsections handbook_subsections_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_subsections
    ADD CONSTRAINT handbook_subsections_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.handbook_sections(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: handbook_sections Admins can delete handbook sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete handbook sections" ON public.handbook_sections FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: handbook_subsections Admins can delete handbook subsections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete handbook subsections" ON public.handbook_subsections FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: hr_contact_settings Admins can insert HR contact settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert HR contact settings" ON public.hr_contact_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: handbook_sections Admins can insert handbook sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert handbook sections" ON public.handbook_sections FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: handbook_subsections Admins can insert handbook subsections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert handbook subsections" ON public.handbook_subsections FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: hr_contact_settings Admins can update HR contact settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update HR contact settings" ON public.hr_contact_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: handbook_sections Admins can update handbook sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update handbook sections" ON public.handbook_sections FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: handbook_subsections Admins can update handbook subsections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update handbook subsections" ON public.handbook_subsections FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: handbook_signatures Admins can view all signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all signatures" ON public.handbook_signatures FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: hr_contact_settings Anyone can view HR contact settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view HR contact settings" ON public.hr_contact_settings FOR SELECT USING (true);


--
-- Name: handbook_sections Anyone can view handbook sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view handbook sections" ON public.handbook_sections FOR SELECT USING (true);


--
-- Name: handbook_subsections Anyone can view handbook subsections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view handbook subsections" ON public.handbook_subsections FOR SELECT USING (true);


--
-- Name: handbook_signatures Users can insert their own signature; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own signature" ON public.handbook_signatures FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: handbook_signatures Users can view their own signature; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own signature" ON public.handbook_signatures FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: handbook_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handbook_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: handbook_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handbook_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: handbook_subsections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handbook_subsections ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_contact_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_contact_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


