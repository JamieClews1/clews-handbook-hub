CREATE TABLE public.route_one_recent_sites (
 site_key text PRIMARY KEY, customer text NOT NULL, site text NOT NULL, postcode text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', area text NOT NULL DEFAULT '', contact text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', sic text NOT NULL DEFAULT '', source text NOT NULL, last_used date NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), search_text text NOT NULL
);
GRANT SELECT ON public.route_one_recent_sites TO authenticated;
GRANT ALL ON public.route_one_recent_sites TO service_role;
ALTER TABLE public.route_one_recent_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY recent_sites_staff_read ON public.route_one_recent_sites FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user'));
CREATE INDEX recent_sites_last_used_idx ON public.route_one_recent_sites(last_used DESC);
CREATE INDEX recent_sites_customer_idx ON public.route_one_recent_sites(customer);
CREATE OR REPLACE FUNCTION public.record_recent_booking_site(p_customer text,p_site text,p_postcode text,p_address text,p_area text,p_contact text,p_phone text,p_sic text,p_source text,p_date date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text; today date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
 IF nullif(trim(p_customer),'') IS NULL OR nullif(trim(p_site),'') IS NULL OR p_date IS NULL OR p_date < (today - interval '6 months')::date OR p_date > today THEN RETURN; END IF;
 k := md5(lower(trim(p_customer)) || '|' || lower(trim(p_site)) || '|' || regexp_replace(upper(coalesce(p_postcode,'')),'[^A-Z0-9]','','g'));
 INSERT INTO public.route_one_recent_sites(site_key,customer,site,postcode,address,area,contact,phone,sic,source,last_used,search_text)
 VALUES(k,trim(p_customer),trim(p_site),coalesce(p_postcode,''),coalesce(p_address,''),coalesce(p_area,''),coalesce(p_contact,''),coalesce(p_phone,''),coalesce(p_sic,''),p_source,p_date,lower(trim(p_customer)||' '||trim(p_site)||' '||coalesce(p_postcode,''))||' '||lower(regexp_replace(coalesce(p_postcode,''),'[^A-Za-z0-9]','','g')))
 ON CONFLICT(site_key) DO UPDATE SET last_used=excluded.last_used,address=coalesce(nullif(excluded.address,''),route_one_recent_sites.address),area=coalesce(nullif(excluded.area,''),route_one_recent_sites.area),contact=coalesce(nullif(excluded.contact,''),route_one_recent_sites.contact),phone=coalesce(nullif(excluded.phone,''),route_one_recent_sites.phone),sic=coalesce(nullif(excluded.sic,''),route_one_recent_sites.sic),source=excluded.source,updated_at=now()
 WHERE excluded.last_used >= route_one_recent_sites.last_used AND (excluded.last_used,excluded.address,excluded.area,excluded.contact,excluded.phone,excluded.sic) IS DISTINCT FROM (route_one_recent_sites.last_used,route_one_recent_sites.address,route_one_recent_sites.area,route_one_recent_sites.contact,route_one_recent_sites.phone,route_one_recent_sites.sic);
END $$;
REVOKE ALL ON FUNCTION public.record_recent_booking_site(text,text,text,text,text,text,text,text,text,date) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.capture_recent_booking_site() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a text;
BEGIN
 IF TG_TABLE_NAME='route_one_jobs' THEN
  PERFORM public.record_recent_booking_site(NEW.customer_name,NEW.site_name,NEW.site_postcode,concat_ws(E'\n',nullif(NEW.site_address,''),nullif(NEW.site_address_2,'')),NEW.site_area,NEW.site_contact_name,NEW.site_contact_phone,NEW.sic_code,'routeone',NEW.scheduled_date);
 ELSIF NEW.source='skiptrak' AND upper(coalesce(NEW.raw->>'Status','')) <> 'V' THEN
  SELECT string_agg(v,E'\n' ORDER BY pos) INTO a FROM (SELECT v,min(pos) pos FROM unnest(ARRAY[NEW.raw->>'Address 1',coalesce(NEW.raw->>'Address 2',NEW.raw->>'Address 2nd LIne'),NEW.raw->>'Address 3',NEW.raw->>'Address 3_1',NEW.raw->>'Address 4',NEW.raw->>'Address 5']) WITH ORDINALITY x(v,pos) WHERE nullif(trim(v),'') IS NOT NULL GROUP BY v) t;
  PERFORM public.record_recent_booking_site(NEW.customer,NEW.site,coalesce(nullif(NEW.postcode,''),NEW.raw->>'Postcode'),coalesce(a,NEW.raw->>'Site Address',NEW.raw->>'Site address',NEW.raw->>'Address'),NEW.raw->>'Area',NEW.raw->>'Contact',coalesce(NEW.raw->>'Contact mobile',NEW.raw->>'Contact Phone'),NEW.raw->>'SIC Code','skiptrak',NEW.job_date);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_recent_booking_site() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER recent_site_from_routeone AFTER INSERT OR UPDATE OF customer_name,site_name,site_postcode,site_address,site_address_2,site_area,site_contact_name,site_contact_phone,sic_code,scheduled_date ON public.route_one_jobs FOR EACH ROW EXECUTE FUNCTION public.capture_recent_booking_site();
CREATE TRIGGER recent_site_from_skiptrak AFTER INSERT OR UPDATE OF customer,site,postcode,raw,job_date ON public.data_hub_jobs FOR EACH ROW EXECUTE FUNCTION public.capture_recent_booking_site();
INSERT INTO public.route_one_recent_sites(site_key,customer,site,postcode,address,area,contact,phone,sic,source,last_used,search_text)
SELECT DISTINCT ON (k) k,customer,site,postcode,address,area,contact,phone,sic,source,d,lower(customer||' '||site||' '||postcode)||' '||lower(regexp_replace(postcode,'[^A-Za-z0-9]','','g')) FROM (
 SELECT md5(lower(trim(customer))||'|'||lower(trim(site))||'|'||regexp_replace(upper(coalesce(postcode,'')),'[^A-Z0-9]','','g')) k,trim(customer) customer,trim(site) site,coalesce(postcode,'') postcode,coalesce(nullif(concat_ws(E'\n',nullif(raw->>'Address 1',''),nullif(raw->>'Address 2',''),nullif(raw->>'Address 3',''),nullif(raw->>'Address 3_1',''),nullif(raw->>'Address 4',''),nullif(raw->>'Address 5','')),''),raw->>'Site Address',raw->>'Site address',raw->>'Address','') address,coalesce(raw->>'Area','') area,coalesce(raw->>'Contact','') contact,coalesce(raw->>'Contact mobile',raw->>'Contact Phone','') phone,coalesce(raw->>'SIC Code','') sic,'skiptrak' source,job_date d FROM public.data_hub_jobs WHERE source='skiptrak' AND upper(coalesce(raw->>'Status',''))<>'V' AND job_date BETWEEN ((now() AT TIME ZONE 'Europe/London')::date - interval '6 months')::date AND (now() AT TIME ZONE 'Europe/London')::date AND nullif(trim(customer),'') IS NOT NULL AND nullif(trim(site),'') IS NOT NULL
 UNION ALL
 SELECT md5(lower(trim(customer_name))||'|'||lower(trim(site_name))||'|'||regexp_replace(upper(coalesce(site_postcode,'')),'[^A-Z0-9]','','g')),trim(customer_name),trim(site_name),coalesce(site_postcode,''),concat_ws(E'\n',nullif(site_address,''),nullif(site_address_2,'')),coalesce(site_area,''),coalesce(site_contact_name,''),coalesce(site_contact_phone,''),coalesce(sic_code,''),'routeone',scheduled_date FROM public.route_one_jobs WHERE scheduled_date BETWEEN ((now() AT TIME ZONE 'Europe/London')::date - interval '6 months')::date AND (now() AT TIME ZONE 'Europe/London')::date AND nullif(trim(customer_name),'') IS NOT NULL AND nullif(trim(site_name),'') IS NOT NULL
) entries ORDER BY k,d DESC,(address<>'') DESC ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.search_recent_booking_sites(p_query text DEFAULT '',p_customer text DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS SETOF public.route_one_recent_sites LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT * FROM public.route_one_recent_sites WHERE last_used BETWEEN ((now() AT TIME ZONE 'Europe/London')::date - interval '6 months')::date AND (now() AT TIME ZONE 'Europe/London')::date
 AND (p_customer IS NULL OR customer= p_customer) AND (coalesce(p_query,'')='' OR position(lower(trim(p_query)) IN search_text)>0)
 ORDER BY last_used DESC,customer,site LIMIT greatest(1,least(coalesce(p_limit,20),2000));
$$;
REVOKE ALL ON FUNCTION public.search_recent_booking_sites(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_recent_booking_sites(text,text,integer) TO authenticated,service_role;