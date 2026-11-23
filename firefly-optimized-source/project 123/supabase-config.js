/*
  Firefly Café Admin — Supabase configuration

  Put your browser-safe Supabase values here.
  NEVER put a service_role/secret key in this file.

  If your existing project already has a Supabase config, you can instead
  expose the client as window.supabaseClient and remove this file's client
  creation code.
*/
const SUPABASE_URL = "https://ipkncxferyaxscaputzr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GboTOLJBktga7LMcK8mwZA_MpEAq76b";

if (window.supabase && SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_PUBLISHABLE_KEY !== "YOUR_SUPABASE_PUBLISHABLE_KEY") {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
