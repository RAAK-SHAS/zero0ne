import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { hashPassword, verifyPassword } from "../_shared/password-hash.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, folderId, password, newPassword } = await req.json();

    // Verify folder ownership
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id, user_id, is_locked, password_hash")
      .eq("id", folderId)
      .single();

    if (folderError || !folder) {
      return new Response(JSON.stringify({ error: "Folder not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (folder.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "lock") {
      if (!password || password.length < 4) {
        return new Response(JSON.stringify({ error: "Password must be at least 4 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hash = await hashPassword(password);
      await supabase
        .from("folders")
        .update({ is_locked: true, password_hash: hash })
        .eq("id", folderId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unlock") {
      if (!password) {
        return new Response(JSON.stringify({ error: "Password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyPassword(password, folder.password_hash || "");
      if (!valid) {
        return new Response(JSON.stringify({ error: "Incorrect password" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove_lock") {
      if (!password) {
        return new Response(JSON.stringify({ error: "Current password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyPassword(password, folder.password_hash || "");
      if (!valid) {
        return new Response(JSON.stringify({ error: "Incorrect password" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase
        .from("folders")
        .update({ is_locked: false, password_hash: null })
        .eq("id", folderId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change_password") {
      if (!password || !newPassword) {
        return new Response(JSON.stringify({ error: "Both current and new password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (newPassword.length < 4) {
        return new Response(JSON.stringify({ error: "New password must be at least 4 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyPassword(password, folder.password_hash || "");
      if (!valid) {
        return new Response(JSON.stringify({ error: "Incorrect current password" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hash = await hashPassword(newPassword);
      await supabase
        .from("folders")
        .update({ password_hash: hash })
        .eq("id", folderId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
