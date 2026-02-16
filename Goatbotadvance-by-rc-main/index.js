const { spawn } = require("child_process");
const log = require("./utils/logger/log.js");
const express = require("express");

const app = express();
const PORT = 5000;

// keep-alive route (Render requirement)
app.get("/", (req, res) => {
  res.send("Maria v3 Bot is running");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("HTTP server running on port", PORT);
});

// ---- BOT LAUNCHER ----
let restartCount = 0;
const MAX_RESTARTS = 5;

function startProject() {
  if (restartCount >= MAX_RESTARTS) {
    log.err("INDEX", `Too many crashes (${restartCount}). Bot stopped.`);
    return;
  }

  const child = spawn("node", ["Main.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true,
    env: process.env // Render env 그대로
  });

  child.on("close", (code) => {
    if (code !== 0) {
      restartCount++;
      log.info(`Main.js crashed (${code}). Restarting ${restartCount}/${MAX_RESTARTS}`);
      setTimeout(startProject, 3000);
    }
  });

  child.on("error", (err) => {
    log.err("INDEX", "Failed to start Goat.js", err);
  });
}

startProject();
