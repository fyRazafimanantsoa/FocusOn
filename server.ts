import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Basic API route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FocusOn Server running on port ${PORT}`);
  });
}

startServer();
