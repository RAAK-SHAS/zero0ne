import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Try to parse JSON from AI response
    let result;
    try {
      // Handle markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      result = JSON.parse(jsonMatch[1]?.trim() || content);
    } catch {
      // If not valid JSON, try to extract a command
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
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
