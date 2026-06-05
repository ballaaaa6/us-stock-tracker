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

  // Set CORS headers for local testing if needed
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

    // Check if user already exists
    const existingUser = await PORTFOLIOS.get(`user:${cleanUsername}`);
    if (existingUser) {
      return new Response(JSON.stringify({ error: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Hash password and store user
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    const newUser = {
      username: cleanUsername,
      passwordHash,
      id: userId
    };

    // Store user data
    await PORTFOLIOS.put(`user:${cleanUsername}`, JSON.stringify(newUser));

    // Initialize empty portfolio for this user
    await PORTFOLIOS.put(`portfolio:${userId}`, JSON.stringify([]));

    return new Response(JSON.stringify({ message: "สมัครสมาชิกสำเร็จแล้ว! สามารถล็อกอินเข้าใช้งานได้เลย" }), {
      status: 200,
      headers: corsHeaders
    });
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
