// Helper function for SHA-256 hashing
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "dime_app_salt_2026!");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const PORTFOLIOS = env.PORTFOLIOS;
  const SUPABASE_URL = env.SUPABASE_URL || "https://ajvcadeyfehgazrduvtt.supabase.co";
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    let userJson = null;
    let isFromSupabase = false;

    // Try Supabase first (for hosted environment)
    if (SUPABASE_SERVICE_KEY && SUPABASE_URL) {
      try {
        const supabaseRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(cleanUsername)}`,
          {
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              apikey: SUPABASE_SERVICE_KEY,
              "Content-Type": "application/json"
            }
          }
        );

        if (supabaseRes.ok) {
          const users = await supabaseRes.json();
          if (users && users.length > 0) {
            userJson = JSON.stringify(users[0]);
            isFromSupabase = true;
          }
        }
      } catch (err) {
        console.warn("Supabase query failed, falling back to KV:", err.message);
      }
    }

    // Fallback to Cloudflare KV if Supabase failed or not configured
    if (!userJson && PORTFOLIOS) {
      userJson = await PORTFOLIOS.get(`user:${cleanUsername}`);
    }

    // Pre-configured Admin Auto-Generation (only in KV)
    if (!userJson && cleanUsername === "admin" && PORTFOLIOS) {
      const adminHash = await hashPassword("123456");
      const adminId = crypto.randomUUID();
      const adminUser = {
        username: "admin",
        passwordHash: adminHash,
        id: adminId
      };
      await PORTFOLIOS.put("user:admin", JSON.stringify(adminUser));
      await PORTFOLIOS.put(`portfolio:${adminId}`, JSON.stringify([]));
      userJson = JSON.stringify(adminUser);
    }

    if (!userJson) {
      return new Response(JSON.stringify({ error: "ไม่พบชื่อผู้ใช้นี้ในระบบ" }), { status: 401, headers: corsHeaders });
    }

    const user = JSON.parse(userJson);

    // Verify password hash
    const inputHash = await hashPassword(password);
    if (user.passwordHash !== inputHash) {
      return new Response(JSON.stringify({ error: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Login successful - return a session token
    return new Response(
      JSON.stringify({
        message: "เข้าสู่ระบบสำเร็จ!",
        token: user.id,
        username: user.username,
        userId: user.id
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Handle preflight requests
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
