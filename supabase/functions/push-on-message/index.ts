// supabase/functions/push-on-message/index.ts
// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 从环境变量读取（注意：本地 functions serve 会跳过以 SUPABASE_ 开头的 .env 变量）
// 为兼容本地与线上，这里做多名称回退：
//  - 线上/部署：建议用 secrets 名称 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//  - 本地 serve：请在 .env 使用非 SUPABASE_ 前缀，例如 URL / SERVICE_ROLE
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE")!

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send"

// 简单校验：只允许 service role 调用（来自数据库触发）
function assertServiceRole(req: Request) {
  const auth = req.headers.get("authorization") || ""
  if (!auth || !auth.includes(SERVICE_ROLE.slice(0, 16))) {
    // 这里也可以严格对比完整 key，或改成使用自定义 Header + SECRET
    console.warn("Unauthorized invocation")
    return false
  }
  return true
}

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })
    // 可选：鉴权（建议开启）
    // if (!assertServiceRole(req)) return new Response("Unauthorized", { status: 401 })

    const { messageId, receiveId } = await req.json()
    if (!messageId) return new Response("Missing messageId", { status: 400 })

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

    // 1) 查消息
    const { data: msg, error: e1 } = await admin
      .from("messages")
      .select("id, room, sender, content, created_at")
      .eq("id", messageId)
      .single()
    if (e1 || !msg) throw e1 ?? new Error("message not found")

    // 查询 profiles 表
    const { data: tokens, error: e3 } = await admin
      .from("profiles")
      .select("id, expo_push_token")
      .in("id", [receiveId])
      .not("expo_push_token", "is", null)
    if (e3) throw e3

    const payloads = (tokens ?? []).map(t => ({
      to: t.expo_push_token,
      title: "新消息",
      body: msg.content?.slice(0, 50) || "你收到一条新消息",
      data: { screen: `product/${msg.room}`, messageId: msg.id }, // 点击跳转
    }))

    if (payloads.length === 0) return new Response("No valid tokens", { status: 200 })

    // 4) 调 Expo Push API（可分批 100 个/次）
    const r = await fetch(EXPO_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloads),
    })
    const jr = await r.json()

    return new Response(JSON.stringify({ ok: true, expo: jr }), { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
})
