/*
  # Comprehensive Security Fixes

  1. Function Search Path
    - Set `search_path = ''` on notify_new_inquiry, auto_assign_first_admin, is_super_admin
    - Prevents search_path manipulation attacks on SECURITY DEFINER functions

  2. RLS Policy Restrictions
    - Replace overly permissive INSERT policies on `inquiries` and `page_views`
    - New policies restrict insertable columns to only those expected from public forms

  3. Storage Bucket Listing
    - Drop broad SELECT policies on storage.objects for section-media and site-assets
    - Public buckets serve files via direct URL without needing SELECT on storage.objects

  4. SECURITY DEFINER Function Access
    - Revoke EXECUTE from anon and authenticated on all three functions
    - notify_new_inquiry: trigger-only, never called via RPC
    - auto_assign_first_admin: trigger-only, never called via RPC
    - is_super_admin: grant back to authenticated only (used in RLS policies)

  5. Notes
    - Leaked password protection requires Supabase Dashboard toggle (not SQL-configurable)
*/

-- ============================================================
-- 1. Fix function search_path (prevents search_path injection)
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_new_inquiry()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, inquiry_id)
  VALUES (
    'inquiry',
    '신규 도입문의 접수',
    NEW.company || ' ' || NEW.name || '님의 문의가 접수되었습니다. (' || NEW.id || ')',
    NEW.id
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role, display_name)
    VALUES (NEW.user_id, 'super_admin', '시스템 관리자');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$function$;

-- ============================================================
-- 2. Restrict RLS policies on inquiries and page_views
-- ============================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can submit inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Anyone can track page views" ON public.page_views;

-- Inquiries: allow anon insert but only for form-submission columns
CREATE POLICY "Anon can submit inquiry form data only"
  ON public.inquiries
  FOR INSERT
  TO anon
  WITH CHECK (
    company IS NOT NULL
    AND name IS NOT NULL
    AND phone IS NOT NULL
    AND email IS NOT NULL
    AND status = '접수대기'
    AND admin_notes = '[]'::jsonb
    AND status_history = '[]'::jsonb
    AND reply_content IS NULL
    AND replied_at IS NULL
  );

-- Page views: allow anon insert but restrict to analytics columns only
CREATE POLICY "Anon can insert page view with valid path"
  ON public.page_views
  FOR INSERT
  TO anon
  WITH CHECK (
    page_path IS NOT NULL
    AND length(page_path) <= 500
    AND length(referrer) <= 2000
    AND length(user_agent) <= 1000
    AND length(session_id) <= 200
  );

-- ============================================================
-- 3. Remove broad SELECT policies on storage buckets
-- ============================================================

DROP POLICY IF EXISTS "Public read access for section media" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for site assets" ON storage.objects;

-- ============================================================
-- 4. Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions
-- ============================================================

-- notify_new_inquiry is a trigger function - no one should call it via RPC
REVOKE EXECUTE ON FUNCTION public.notify_new_inquiry() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_new_inquiry() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_inquiry() FROM public;

-- auto_assign_first_admin is a trigger function - no one should call it via RPC
REVOKE EXECUTE ON FUNCTION public.auto_assign_first_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_assign_first_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_first_admin() FROM public;

-- is_super_admin is used in RLS policies - only authenticated users need it
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
