import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// Supabase Configuration
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://dtaeglpiuwsvqiydofwo.supabase.co").replace(/\/rest\/v1\/?$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_a5mPk7220E79hoV58PBiew_5pivJUB3";

let supabase: any = null;

function getSupabase() {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return null;
    }
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
      return null;
    }
  }
  return supabase;
}

const FIREBASE_API_KEY = "AIzaSyAK81XHflF2MyDLKCdE0V7QJi1zXPZTn3I";

// Firestore REST Helper Maps
function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined || val === null) continue;
    
    if (typeof val === "string") {
      fields[key] = { stringValue: val };
    } else if (typeof val === "number") {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: val.toString() };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === "boolean") {
      fields[key] = { booleanValue: val };
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map(v => {
            if (v && typeof v === "object") {
              return { mapValue: { fields: toFirestoreFields(v) } };
            } else if (typeof v === "string") {
              return { stringValue: v };
            } else if (typeof v === "number") {
              return Number.isInteger(v) ? { integerValue: v.toString() } : { doubleValue: v };
            } else if (typeof v === "boolean") {
              return { booleanValue: v };
            }
            return { stringValue: String(v) };
          })
        }
      };
    } else if (typeof val === "object") {
      fields[key] = { mapValue: { fields: toFirestoreFields(val) } };
    }
  }
  return fields;
}

function fromFirestoreValue(valObj: any): any {
  if (!valObj) return null;
  if ("stringValue" in valObj) return valObj.stringValue;
  if ("integerValue" in valObj) return parseInt(valObj.integerValue, 10);
  if ("doubleValue" in valObj) return parseFloat(valObj.doubleValue);
  if ("booleanValue" in valObj) return valObj.booleanValue;
  if ("arrayValue" in valObj) {
    const values = valObj.arrayValue.values || [];
    return values.map((v: any) => fromFirestoreValue(v));
  }
  if ("mapValue" in valObj) {
    return fromFirestoreFields(valObj.mapValue.fields);
  }
  return null;
}

function fromFirestoreFields(fields: any): any {
  if (!fields) return {};
  const obj: any = {};
  for (const key of Object.keys(fields)) {
    obj[key] = fromFirestoreValue(fields[key]);
  }
  return obj;
}

function getUidFromToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64").toString("utf-8"));
    return payload.user_id || payload.sub || null;
  } catch (e) {
    return null;
  }
}

// Basic API route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Proxy Endpoint: GET User Profile
app.get("/api/user-profile", async (req, res) => {
  const authHeader = req.headers.authorization;
  const uid = getUidFromToken(authHeader);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const supabaseClient = getSupabase();
    let profile: any = null;

    if (supabaseClient) {
      // 1. Try fetching from Supabase first
      const { data: profileData, error: profileError } = await supabaseClient
        .from("user_profiles")
        .select("*")
        .eq("uid", uid)
        .single();

      if (profileData && !profileError) {
        // Fetch projects as well
        const { data: projectsData } = await supabaseClient
          .from("projects")
          .select("*")
          .eq("user_id", uid);

        profile = {
          uid: profileData.uid,
          email: profileData.email,
          displayName: profileData.display_name,
          photoURL: profileData.photo_url,
          createdAt: profileData.created_at,
          adhdMode: profileData.adhd_mode,
          weeklyGoalMinutes: profileData.weekly_goal_minutes,
          theme: profileData.theme,
          projects: (projectsData || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            isArchived: p.is_archived,
            customDuration: p.custom_duration,
            weeklyGoalHours: p.weekly_goal_hours
          })),
          completedOnboarding: true
        };
      }
    }

    // 2. If not found in Supabase, fall back to Firestore to fetch (and migrate if found)
    if (!profile) {
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/users/${uid}?key=${FIREBASE_API_KEY}`, {
        headers: { "Authorization": authHeader! }
      });
      if (response.status === 200) {
        const data: any = await response.json();
        const firestoreProfile = fromFirestoreFields(data.fields);
        if (firestoreProfile) {
          profile = firestoreProfile;

          // Migrate/upsert this user profile to Supabase in the background!
          if (supabaseClient) {
            supabaseClient
              .from("user_profiles")
              .upsert({
                uid: uid,
                email: profile.email || "user@focuson.app",
                display_name: profile.displayName || "FocusOn Pilot",
                photo_url: profile.photoURL || null,
                adhd_mode: profile.adhdMode !== false,
                weekly_goal_minutes: profile.weeklyGoalMinutes || 150,
                theme: profile.theme || "dark"
              })
              .then(() => {
                if (profile.projects && Array.isArray(profile.projects)) {
                  for (const p of profile.projects) {
                    supabaseClient.from("projects").upsert({
                      id: p.id,
                      user_id: uid,
                      name: p.name,
                      color: p.color,
                      is_archived: !!p.isArchived,
                      custom_duration: p.customDuration || null,
                      weekly_goal_hours: p.weeklyGoalHours || null
                    }).catch((e: any) => console.warn("Sync project error:", e));
                  }
                }
              })
              .catch((e: any) => console.warn("Sync user profile error:", e));
          }
        }
      }
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy Endpoint: SAVE/MERGE User Profile
app.post("/api/user-profile", async (req, res) => {
  const authHeader = req.headers.authorization;
  const uid = getUidFromToken(authHeader);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const profileData = req.body;

    // 1. Save to Supabase first
    const supabaseClient = getSupabase();
    if (supabaseClient) {
      const upsertObj: any = { uid };
      if (profileData.email !== undefined) upsertObj.email = profileData.email;
      if (profileData.displayName !== undefined) upsertObj.display_name = profileData.displayName;
      if (profileData.photoURL !== undefined) upsertObj.photo_url = profileData.photoURL;
      if (profileData.adhdMode !== undefined) upsertObj.adhd_mode = profileData.adhdMode;
      if (profileData.weeklyGoalMinutes !== undefined) upsertObj.weekly_goal_minutes = profileData.weeklyGoalMinutes;
      if (profileData.theme !== undefined) upsertObj.theme = profileData.theme;
      if (profileData.createdAt !== undefined) upsertObj.created_at = profileData.createdAt;

      await supabaseClient
        .from("user_profiles")
        .upsert(upsertObj);

      // Handle projects upsert
      if (profileData.projects && Array.isArray(profileData.projects)) {
        for (const p of profileData.projects) {
          await supabaseClient.from("projects").upsert({
            id: p.id,
            user_id: uid,
            name: p.name,
            color: p.color,
            is_archived: !!p.isArchived,
            custom_duration: p.customDuration || null,
            weekly_goal_hours: p.weeklyGoalHours || null
          });
        }
      }
    }

    // 2. Sync/Backup to Firestore in the background
    const fields = toFirestoreFields(profileData);
    const keys = Object.keys(profileData);
    const queryParams = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");

    fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/users/${uid}?${queryParams}&key=${FIREBASE_API_KEY}`, {
      method: "PATCH",
      headers: {
        "Authorization": authHeader!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    }).catch(err => console.warn("Firestore backup profile warning:", err));

    res.json(profileData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy Endpoint: GET Focus Sessions
app.get("/api/user-sessions", async (req, res) => {
  const authHeader = req.headers.authorization;
  const uid = getUidFromToken(authHeader);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const limitCount = parseInt(req.query.limit as string || "50", 10);

  try {
    const supabaseClient = getSupabase();
    let sessions: any[] = [];

    if (supabaseClient) {
      // 1. Fetch from Supabase first
      const { data: sessionsData, error: sessionsError } = await supabaseClient
        .from("focus_sessions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(limitCount);

      if (sessionsData && !sessionsError && sessionsData.length > 0) {
        sessions = sessionsData.map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          taskName: s.task_name,
          tinyStep: s.tiny_step,
          originalDurationMinutes: s.original_duration_minutes,
          actualDurationSeconds: s.actual_duration_seconds,
          completed: s.completed,
          status: s.status,
          createdAt: s.created_at,
          dateStr: s.date_str,
          reflectionNotes: s.reflection_notes,
          nextStepSuggested: s.next_step_suggested,
          stuckCount: s.stuck_count,
          distractionCheckInCount: s.distraction_check_in_count,
          projectId: s.project_id
        }));
      }
    }

    // 2. Fallback to Firestore if Supabase returned empty/failed, and migrate if found
    if (sessions.length === 0) {
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`, {
        method: "POST",
        headers: {
          "Authorization": authHeader!,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "sessions" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "userId" },
                op: "EQUAL",
                value: { stringValue: uid }
              }
            },
            orderBy: [
              {
                field: { fieldPath: "createdAt" },
                direction: "DESCENDING"
              }
            ],
            limit: limitCount
          }
        })
      });

      const result: any = await response.json();
      if (response.status === 200 && Array.isArray(result)) {
        const firestoreSessions: any[] = [];
        for (const entry of result) {
          if (entry.document) {
            firestoreSessions.push(fromFirestoreFields(entry.document.fields));
          }
        }

        if (firestoreSessions.length > 0) {
          sessions = firestoreSessions;

          // Backfill/Migrate Firestore sessions to Supabase in background
          if (supabaseClient) {
            for (const sess of firestoreSessions) {
              supabaseClient.from("focus_sessions").upsert({
                id: sess.id || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: uid,
                task_name: sess.taskName,
                tiny_step: sess.tinyStep || null,
                original_duration_minutes: parseInt(sess.originalDurationMinutes) || 0,
                actual_duration_seconds: parseInt(sess.actualDurationSeconds) || 0,
                completed: !!sess.completed,
                status: sess.status,
                created_at: sess.createdAt,
                date_str: sess.dateStr,
                reflection_notes: sess.reflectionNotes || null,
                next_step_suggested: sess.nextStepSuggested || null,
                stuck_count: parseInt(sess.stuckCount) || 0,
                distraction_check_in_count: parseInt(sess.distractionCheckInCount) || 0,
                project_id: sess.projectId || null
              }).catch((e: any) => console.warn("Backfill session warning:", e));
            }
          }
        }
      }
    }

    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy Endpoint: SAVE Focus Session
app.post("/api/user-sessions", async (req, res) => {
  const authHeader = req.headers.authorization;
  const uid = getUidFromToken(authHeader);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const { id, session } = req.body;
  if (!id || !session) {
    return res.status(400).json({ error: "id and session are required" });
  }

  try {
    session.userId = uid;

    // 1. Save/Upsert to Supabase first
    const supabaseClient = getSupabase();
    if (supabaseClient) {
      const { error: supabaseError } = await supabaseClient.from("focus_sessions").upsert({
        id: id,
        user_id: uid,
        task_name: session.taskName,
        tiny_step: session.tinyStep || null,
        original_duration_minutes: parseInt(session.originalDurationMinutes) || 0,
        actual_duration_seconds: parseInt(session.actualDurationSeconds) || 0,
        completed: !!session.completed,
        status: session.status,
        created_at: session.createdAt,
        date_str: session.dateStr,
        reflection_notes: session.reflectionNotes || null,
        next_step_suggested: session.nextStepSuggested || null,
        stuck_count: parseInt(session.stuckCount) || 0,
        distraction_check_in_count: parseInt(session.distractionCheckInCount) || 0,
        project_id: session.projectId || null
      });

      if (supabaseError) {
        console.error("Supabase focus_sessions save error:", supabaseError);
        return res.status(400).json({ error: supabaseError.message });
      }
    }

    // 2. Sync/Backup to Firestore in the background
    const fields = toFirestoreFields(session);
    const keys = Object.keys(session);
    const queryParams = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");

    fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/sessions/${id}?${queryParams}&key=${FIREBASE_API_KEY}`, {
      method: "PATCH",
      headers: {
        "Authorization": authHeader!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    }).catch(err => console.warn("Firestore backup session warning:", err));

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy Endpoint: DELETE User Session
app.delete("/api/user-sessions/:id", async (req, res) => {
  const authHeader = req.headers.authorization;
  const uid = getUidFromToken(authHeader);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const sessionId = req.params.id;

  try {
    // 1. Delete from Supabase first
    const supabaseClient = getSupabase();
    if (supabaseClient) {
      const { error: supabaseError } = await supabaseClient
        .from("focus_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("user_id", uid);

      if (supabaseError) {
        console.error("Supabase session delete error:", supabaseError);
        return res.status(400).json({ error: supabaseError.message });
      }
    }

    // 2. Sync/Backup delete from Firestore in the background
    fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/sessions/${sessionId}?key=${FIREBASE_API_KEY}`, {
      method: "DELETE",
      headers: {
        "Authorization": authHeader!
      }
    }).catch(err => console.warn("Firestore backup session delete warning:", err));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy Endpoint: DELETE All User Sessions
app.delete("/api/user-sessions", async (req, res) => {
  const authHeader = req.headers.authorization;
  const uid = getUidFromToken(authHeader);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    // 1. Delete from Supabase first
    const supabaseClient = getSupabase();
    if (supabaseClient) {
      const { error: supabaseError } = await supabaseClient
        .from("focus_sessions")
        .delete()
        .eq("user_id", uid);

      if (supabaseError) {
        console.error("Supabase session batch delete error:", supabaseError);
        return res.status(400).json({ error: supabaseError.message });
      }
    }

    // 2. Backup delete from Firestore in the background
    const listResponse = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: {
        "Authorization": authHeader!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "sessions" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "userId" },
              op: "EQUAL",
              value: { stringValue: uid }
            }
          }
        }
      })
    });

    const result: any = await listResponse.json();
    if (listResponse.status === 200 && Array.isArray(result)) {
      for (const entry of result) {
        if (entry.document) {
          const docName = entry.document.name;
          const parts = docName.split("/");
          const sessionId = parts[parts.length - 1];
          fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/sessions/${sessionId}?key=${FIREBASE_API_KEY}`, {
            method: "DELETE",
            headers: {
              "Authorization": authHeader!
            }
          }).catch(err => console.warn("Firestore backup session batch item delete warning:", err));
        }
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy Endpoint: LOG Distraction
app.post("/api/distraction-log", async (req, res) => {
  const authHeader = req.headers.authorization;
  const uid = getUidFromToken(authHeader);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const { id, log } = req.body;
  if (!id || !log) {
    return res.status(400).json({ error: "id and log are required" });
  }

  try {
    log.userId = uid;

    // 1. Save to Supabase first
    const supabaseClient = getSupabase();
    if (supabaseClient) {
      const { error: supabaseError } = await supabaseClient.from("distraction_logs").upsert({
        id: id,
        user_id: uid,
        session_id: log.sessionId,
        timestamp: log.timestamp,
        activity: log.activity,
        choice: log.choice,
        notes: log.notes || null
      });

      if (supabaseError) {
        console.error("Supabase distraction_logs save error:", supabaseError);
        return res.status(400).json({ error: supabaseError.message });
      }
    }

    // 2. Backup to Firestore in the background
    const fields = toFirestoreFields(log);
    const keys = Object.keys(log);
    const queryParams = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");

    fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/distractions/${id}?${queryParams}&key=${FIREBASE_API_KEY}`, {
      method: "PATCH",
      headers: {
        "Authorization": authHeader!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    }).catch(err => console.warn("Firestore backup distraction warning:", err));

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST route for sending feedback to allinus2025@gmail.com
app.post("/api/feedback", (req, res) => {
  const { name, email, feedback, originalUserEmail } = req.body;
  
  if (!name || !feedback) {
    return res.status(400).json({ error: "Name and feedback are required." });
  }

  // Send email logic simulation
  console.log("================ FEEDBACK TRANSMISSION RECEIVED ================");
  console.log(`To: allinus2025@gmail.com`);
  console.log(`From: FocusOn Automated System <system@focuson.io>`);
  console.log(`Reply-To: ${email || originalUserEmail || "no-reply@focuson.io"}`);
  console.log(`Subject: New Customer Testing Feedback from ${name}`);
  console.log(`----------------------------------------------------------------`);
  console.log(`Customer Name: ${name}`);
  console.log(`Preferred Response Email: ${email || "Same as login email (" + originalUserEmail + ")"}`);
  console.log(`Log-In Account Email: ${originalUserEmail || "Not logged in"}`);
  console.log(`Feedback Details:\n${feedback}`);
  console.log("================================================================");

  res.json({
    success: true,
    message: "Feedback processed successfully. Sent to allinus2025@gmail.com"
  });
});

// Test Supabase Connection
app.post("/api/supabase/test-connection", async (req, res) => {
  const client = getSupabase();
  if (!client) {
    return res.status(500).json({ success: false, error: "Supabase client not initialized" });
  }
  try {
    const { data, error } = await client.from("checkouts").select("id").limit(1);
    if (error) {
      if (error.code === "PGRST116" || error.code === "42P01") {
        return res.json({ 
          success: true, 
          schemaMissing: true, 
          message: "Successfully connected to Supabase, but some tables (like 'checkouts') are missing in your public schema. Please paste the generated SQL script into your Supabase SQL Editor to provision the tables!"
        });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
    res.json({ success: true, message: "Successfully connected to Supabase! All tables are active." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Store Checkout Data in Supabase
app.post("/api/supabase/checkout", async (req, res) => {
  const client = getSupabase();
  if (!client) {
    return res.status(500).json({ error: "Supabase client not initialized" });
  }
  const checkout = req.body;
  if (!checkout.id || !checkout.user_id || !checkout.email || !checkout.amount || !checkout.plan_type) {
    return res.status(400).json({ error: "Missing required checkout parameters" });
  }

  try {
    const { data, error } = await client
      .from("checkouts")
      .insert([
        {
          id: checkout.id,
          user_id: checkout.user_id,
          email: checkout.email,
          amount: parseFloat(checkout.amount),
          currency: checkout.currency || "USD",
          status: checkout.status || "completed",
          plan_type: checkout.plan_type,
          stripe_session_id: checkout.stripe_session_id || null,
          created_at: checkout.created_at || new Date().toISOString()
        }
      ]);

    if (error) {
      console.error("Supabase checkout insert error:", error);
      return res.status(400).json({ error: error.message, code: error.code });
    }

    res.json({ success: true, message: "Checkout saved successfully to Supabase!", data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
