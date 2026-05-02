import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_CALLS_PER_HOUR = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the JWT cryptographically via Supabase Auth
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    // Per-user rate limiting backed by ai_call_log table
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await adminClient
      .from("ai_call_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("called_at", sinceIso);

    if ((recentCount ?? 0) >= MAX_CALLS_PER_HOUR) {
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. You can make ${MAX_CALLS_PER_HOUR} AI requests per hour. Please try again later.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, currentPath } = await req.json();

    if (!query || typeof query !== "string" || query.length > 500) {
      return new Response(
        JSON.stringify({ error: "Invalid query" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Record the call before invoking the gateway so concurrent floods can't bypass the limit
    await adminClient.from("ai_call_log").insert({ user_id: userId });

    // Best-effort cleanup of old log rows for this user
    const cutoffIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    adminClient
      .from("ai_call_log")
      .delete()
      .eq("user_id", userId)
      .lt("called_at", cutoffIso)
      .then(() => undefined, () => undefined);

    const systemPrompt = `You are a terminal command translator for a cloud storage app called CloudStore.
Convert natural language queries into terminal commands.

Available commands:
- ls: list files
- cd <folder>: change directory  
- cd ..: go up
- pwd: print working directory
- tree: show folder tree
- download <file>: download file
- open/preview <file>: preview file
- rename <file>: rename file
- delete/trash <file>: move to trash
- mkdir <name>: create folder
- rmdir <folder>: delete folder
- share/link <file>: share file
- find/search <keyword>: find files
- type <image|pdf|video|audio|doc>: filter by type
- move <file> <folder>: move file
- du: disk usage
- upload: open upload

Current directory: ${currentPath}

RULES:
- Return ONLY a JSON object with "command" field containing the terminal command
- If you can't translate, return {"response": "explanation of why"}
- For complex queries that need multiple commands, return the most relevant single command
- Do NOT include explanations in the command field`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content?.trim() || "";

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      result = JSON.parse(jsonMatch[1]?.trim() || content);
    } catch {
      if (content.startsWith("{")) {
        result = { response: "Could not parse AI response" };
      } else {
        result = { command: content };
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("terminal-ai error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
