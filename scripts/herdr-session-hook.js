// Claude Code hook (SessionStart / SessionEnd): records which Claude session runs in which Herdr
// terminal, for the Herdr `claude-session-restore` mod. Writes
// ~/.config/herdr-app/data/claude-sessions/<terminal>.json. Prints nothing, never fails.
const fs = require("fs");
const path = require("path");
const os = require("os");

const DIR = path.join(os.homedir(), ".config", "herdr-app", "data", "claude-sessions");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const terminal = process.env.HC_TERMINAL_ID; // set by herdr-core inside every terminal
    if (!terminal || !/^[A-Za-z0-9_-]+$/.test(terminal)) return;
    const ev = JSON.parse(raw);
    const file = path.join(DIR, terminal + ".json");
    if (ev.hook_event_name === "SessionEnd") {
      // Deliberate exit: don't restore. Other reasons (killed, shutdown) keep the entry.
      // "clear" is followed by a SessionStart that overwrites it.
      if (ev.reason === "prompt_input_exit" || ev.reason === "logout") fs.rmSync(file, { force: true });
      return;
    }
    if (!ev.session_id) return;
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ terminal, session_id: ev.session_id, cwd: ev.cwd || process.cwd(), updated: Math.floor(Date.now() / 1000) }));
    fs.renameSync(tmp, file);
  } catch {}
});
