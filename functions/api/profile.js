export async function onRequest(context) {
  const { request, env } = context;
  const PORTFOLIOS = env.PORTFOLIOS;
  const method = request.method;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "ไม่พบสิทธิ์การใช้งาน" }), { status: 401, headers: corsHeaders });
  }

  const userId = authHeader.split(" ")[1].trim();
  if (!userId) {
    return new Response(JSON.stringify({ error: "โทเค็นไม่ถูกต้อง" }), { status: 401, headers: corsHeaders });
  }

  try {
    if (method === "GET") {
      let profileJson = await PORTFOLIOS.get(`profile:${userId}`);
      if (!profileJson) {
        profileJson = "{}";
      }
      return new Response(profileJson, { status: 200, headers: corsHeaders });
    }

    if (method === "POST") {
      const profileData = await request.json();
      await PORTFOLIOS.put(`profile:${userId}`, JSON.stringify(profileData));
      return new Response(JSON.stringify({ message: "บันทึกโปรไฟล์เรียบร้อย!" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: "เกิดข้อผิดพลาด: " + err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
