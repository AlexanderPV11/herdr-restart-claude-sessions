// Restores Claude Code conversations after a reboot. Herdr brings each terminal back as a plain
// shell in its last folder (same address); ~/.claude/herdr-session-hook.js recorded which Claude
// session ran in each terminal, so this types `claude --resume <id>` into those shells.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { terminals, hc, readTextFile, appHome, theme, checking, notify } from "herdr";

const WINDOW_MS = 120000;          // only try to restore during the first 2 minutes after start
const MAX_AGE = 14 * 86400;        // ignore records older than 14 days
const norm = (p) => String(p || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
const fwd = (p) => String(p).replace(/\\/g, "/");

export default class ClaudeSessionRestore extends View {
  init(_props, cx) {
    this.done = new Set();
    this.restored = 0;
    this.msg = "watching for lost Claude sessions";
    this.startedAt = Date.now();
    if (checking()) return;
    this.scan(cx);
    cx.timer.every(4000, (cx) => { if (Date.now() - this.startedAt < WINDOW_MS) this.scan(cx); });
  }

  scan(cx) {
    cx.spawn(async (cx) => {
      const now = Math.floor(Date.now() / 1000);
      for (const t of terminals()) {
        const addr = t.address;
        if (!addr || String(addr).includes("/") || this.done.has(addr)) continue; // local terminals only
        if (t.state !== "live" || t.agent) { continue; }                           // already running something
        let rec = null;
        try { const txt = await readTextFile(`${appHome()}/data/claude-sessions/${addr}.json`); rec = txt ? JSON.parse(txt) : null; } catch { rec = null; }
        if (!rec || !rec.session_id || !/^[0-9a-f-]{36}$/i.test(rec.session_id)) continue;
        if (now - (rec.updated || 0) > MAX_AGE) continue;
        this.done.add(addr);
        const cd = rec.cwd && norm(rec.cwd) !== norm(t.cwd) ? `cd "${fwd(rec.cwd)}"; ` : "";
        try {
          const r = await hc(["send", addr, `${cd}claude --resume ${rec.session_id}`]);
          if (r.code === 0 || r.code === undefined) this.restored++;
        } catch (e) { this.msg = `could not restore ${addr}`; }
      }
      if (this.restored > 0) {
        this.msg = `restored ${this.restored} Claude session${this.restored > 1 ? "s" : ""}`;
        if (!this.notified) { this.notified = true; notify({ title: "Claude sessions", body: this.msg, level: "info" }); }
      }
      cx.notify();
    });
  }

  render() {
    const t = theme();
    return h_flex().size_full().px(14).items_center().bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(11.5).text_color(t.dim).child(`↻ ${this.msg}`);
  }
}
