# Job Portal Admin Dashboard

A responsive, secure admin dashboard built with **Next.js 14 (App Router)**, **Tailwind CSS**, and the **Supabase JavaScript SDK**.

## Features

- Google OAuth sign-in via Supabase Auth
- Email-based authorization using `NEXT_PUBLIC_ALLOWED_ADMIN_EMAILS`
- Real-time table of job applications with search
- Inline HTML5 audio player for each sample
- One-click audio download using signed Supabase Storage URLs

## Prerequisites

- A Supabase project with the `public.job_applications` table
- A private `applicant-audio` storage bucket
- Google OAuth enabled in Supabase Auth

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/marpo235/job-portal-admin.git
   cd job-portal-admin
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.local.example` to `.env.local` and fill in your real values:

   ```bash
   cp .env.local.example .env.local
   ```

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_ALLOWED_ADMIN_EMAILS=marek@stealthtranslations.com,example@gmail.com
   ```

4. **Required Supabase RLS policies**

   The dashboard expects authenticated admins to be able to **select** from `public.job_applications` and **create signed URLs** from the `applicant-audio` bucket. Example policies:

   ```sql
   -- Allow authenticated users to read applications
   CREATE POLICY "Allow authenticated select on job_applications"
   ON public.job_applications
   FOR SELECT
   TO authenticated
   USING (true);

   -- Allow authenticated users to access storage objects
   CREATE POLICY "Allow authenticated audio access"
   ON storage.objects
   FOR SELECT
   TO authenticated
   USING (bucket_id = 'applicant-audio');
   ```

   For a stricter production setup, restrict these policies to a dedicated `allowed_admin_emails` table or use a service-role API route instead of the anon key.

5. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploy

The easiest deployment is [Vercel](https://vercel.com). Add the environment variables in the Vercel dashboard, set the Supabase redirect URL to `https://<your-domain>/`, and Google will redirect users back to the admin panel.
