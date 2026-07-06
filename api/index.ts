import express from "express";

const app = express();
app.use(express.json());

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
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/users/${uid}`, {
      headers: { "Authorization": authHeader! }
    });
    if (response.status === 404) {
      return res.status(404).json({ error: "Profile not found" });
    }
    const data: any = await response.json();
    if (data.error) {
      return res.status(response.status).json({ error: data.error.message });
    }
    const profile = fromFirestoreFields(data.fields);
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
    const fields = toFirestoreFields(profileData);
    
    const keys = Object.keys(profileData);
    const queryParams = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");

    const response = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/users/${uid}?${queryParams}`, {
      method: "PATCH",
      headers: {
        "Authorization": authHeader!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    });

    const result: any = await response.json();
    if (result.error) {
      return res.status(response.status).json({ error: result.error.message });
    }
    res.json(fromFirestoreFields(result.fields));
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
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents:runQuery`, {
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
    if (response.status !== 200) {
      return res.status(response.status).json({ error: result.error?.message || "Error running query" });
    }

    const sessions: any[] = [];
    if (Array.isArray(result)) {
      for (const entry of result) {
        if (entry.document) {
          sessions.push(fromFirestoreFields(entry.document.fields));
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
    const fields = toFirestoreFields(session);
    const keys = Object.keys(session);
    const queryParams = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");

    const response = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/sessions/${id}?${queryParams}`, {
      method: "PATCH",
      headers: {
        "Authorization": authHeader!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    });

    const result: any = await response.json();
    if (result.error) {
      return res.status(response.status).json({ error: result.error.message });
    }
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
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        "Authorization": authHeader!
      }
    });

    if (response.status !== 200 && response.status !== 204) {
      const result: any = await response.json();
      return res.status(response.status).json({ error: result.error?.message || "Error deleting session" });
    }
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
    const listResponse = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents:runQuery`, {
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
    if (listResponse.status !== 200) {
      return res.status(listResponse.status).json({ error: result.error?.message || "Error getting sessions" });
    }

    if (Array.isArray(result)) {
      for (const entry of result) {
        if (entry.document) {
          const docName = entry.document.name;
          const parts = docName.split("/");
          const sessionId = parts[parts.length - 1];
          await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/sessions/${sessionId}`, {
            method: "DELETE",
            headers: {
              "Authorization": authHeader!
            }
          });
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
    const fields = toFirestoreFields(log);
    const keys = Object.keys(log);
    const queryParams = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");

    const response = await fetch(`https://firestore.googleapis.com/v1/projects/focuson-webapp/databases/(default)/documents/distractions/${id}?${queryParams}`, {
      method: "PATCH",
      headers: {
        "Authorization": authHeader!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    });

    const result: any = await response.json();
    if (result.error) {
      return res.status(response.status).json({ error: result.error.message });
    }
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

export default app;
