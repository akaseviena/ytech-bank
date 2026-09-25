import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync("C:/Users/and_y/Desktop/ytech-bank/.env.local", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await admin.from("profiles").select("card_color").eq("id", "6647cc27-4d6c-4cdc-8ad7-816a92e51203").single();
console.log(error ? JSON.stringify(error) : JSON.stringify(data));
