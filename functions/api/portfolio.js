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

  // 1. Authenticate user using the Bearer token (which is the user's secure UUID)
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "ไม่พบสิทธิ์การใช้งาน กรุณาเข้าสู่ระบบก่อน" }), {
      status: 401,
      headers: corsHeaders
    });
  }

  const userId = authHeader.split(" ")[1].trim();
  if (!userId) {
    return new Response(JSON.stringify({ error: "โทเค็นการใช้งานไม่ถูกต้อง" }), { status: 401, headers: corsHeaders });
  }

  try {
    // 2. GET request - Fetch Portfolio
    if (method === "GET") {
      let portfolioJson = await PORTFOLIOS.get(`portfolio:${userId}`);
      if (!portfolioJson) {
        // If not found, initialize as empty
        portfolioJson = "[]";
        await PORTFOLIOS.put(`portfolio:${userId}`, portfolioJson);
      }

      return new Response(portfolioJson, { status: 200, headers: corsHeaders });
    }

    // 3. POST request - Update Portfolio
    if (method === "POST") {
      const assets = await request.json();

      if (!Array.isArray(assets)) {
        return new Response(JSON.stringify({ error: "รูปแบบข้อมูลพอร์ตไม่ถูกต้อง" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      // Save to KV
      await PORTFOLIOS.put(`portfolio:${userId}`, JSON.stringify(assets));

      return new Response(JSON.stringify({ message: "บันทึกพอร์ตเรียบร้อยแล้ว!" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: "เกิดข้อผิดพลาดในการโหลดข้อมูล: " + err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
