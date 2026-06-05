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

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  try {
    const { username, oldPassword, newPassword } = await request.json();

    if (!username || !oldPassword || !newPassword) {
      return new Response(JSON.stringify({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const userJson = await PORTFOLIOS.get(`user:${cleanUsername}`);
    if (!userJson) {
      return new Response(JSON.stringify({ error: "ไม่พบชื่อผู้ใช้ในระบบ" }), { status: 404, headers: corsHeaders });
    }

    const user = JSON.parse(userJson);

    // Verify old password
    const oldHash = await hashPassword(oldPassword);
    if (user.passwordHash !== oldHash) {
      return new Response(JSON.stringify({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }), { status: 401, headers: corsHeaders });
    }

    // Set new password
    const newHash = await hashPassword(newPassword);
    user.passwordHash = newHash;

    // Save back to KV database
    await PORTFOLIOS.put(`user:${cleanUsername}`, JSON.stringify(user));

    return new Response(JSON.stringify({ message: "เปลี่ยนรหัสผ่านสำเร็จแล้ว!" }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "เกิดข้อผิดพลาด: " + err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

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
