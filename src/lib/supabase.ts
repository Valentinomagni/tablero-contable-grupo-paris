import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://yyyrlopgwmuvfbzwxiwp.supabase.co";

export const supabase = createClient(
  SUPABASE_URL,
  "sb_publishable_cL-5aTeSpy2dNBQHzqO9Sg_D_fncvGN",
);
