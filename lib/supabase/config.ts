// Shared by the server client and the proxy, so both write the same cookies.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// The app only talks to Supabase from the server, so browser scripts never
// need to read the session.
export const sessionCookieOptions = { httpOnly: true };
