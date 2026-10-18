# Firefly Café Admin

A simple, functional vanilla HTML/CSS/JS admin dashboard for Firefly Café.

## Files

- `admin.html` — login + dashboard shell
- `admin.css` — Firefly-styled dashboard UI
- `admin.js` — Supabase-powered dashboard logic
- `supabase-config.js` — browser-safe Supabase connection
- `supabase-schema.sql` — database tables + RLS policies

## Setup

1. Create/run `supabase-schema.sql` in the Supabase SQL Editor.
2. Create the first admin/owner in Supabase Authentication.
3. Add that user's UUID to `profiles` using the SQL comment at the bottom of the schema.
4. Put your Supabase URL and publishable key in `supabase-config.js`.
5. Put these files in your website project, for example:
   `admin/admin.html`
   `admin/admin.css`
   `admin/admin.js`
   `admin/supabase-config.js`
6. Open `admin.html` through Live Server or your deployed site.

## Important

Do not put a Supabase service-role key in `supabase-config.js`.

This first version keeps the system deliberately simple:
- real Supabase Auth
- real reservations
- real menu management
- real order log
- real settings
- gallery records
- RLS

The gallery form currently accepts an image URL. Supabase Storage upload can be added after the core dashboard is confirmed working.
