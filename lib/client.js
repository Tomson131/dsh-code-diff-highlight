// Browser half of the demo plugin — real change data, with the diff opening
// in a right-sidebar TAB (like the shipped `changes-review`) instead of inline.
//
// Pre-built client bundle for the DSH web shell: registers into
// `window.__ModuleLoader__`; `require(...)` resolves against PLATFORM_MODULES
// (react, react-dom, cordis, ui-slots/primitives/dockkit, zod,
// @tanstack/react-virtual, dsh-client-store).
//
// Flow:
//   1. `apply` folds `workspace/changes` events into per-turn data (kind
//      "demo-diff") via `ctx.uiConversation.events.register`.
//   2. It registers a right-sidebar tab type (`dsh-demo-diff-review`) and its
//      body in the keyed `sidebar.right.pane.tab` seat.
//   3. The turn-tail card lists the turn's changed files; clicking one calls
//      `ctx.sidebarRight.openResource(<address>)`, which opens the tab there.

window.__ModuleLoader__.load({
  id: "dsh-code-diff-highlight",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { useState, useEffect, useMemo } = React;

    // ── authenticated routes (document-relative, `api/` prefix required) ────
    function summaryUrl(sessionId, seq) {
      return "api/changes.summary?" + new URLSearchParams({ sessionId, seq: String(seq) });
    }
    function diffUrl(sessionId, seq, index) {
      return "api/changes.diff?" + new URLSearchParams({ sessionId, seq: String(seq), index: String(index) });
    }

    // ── right-sidebar tab address ───────────────────────────────────────────
    const REVIEW_ADDRESS = "dsh-resource://demo-diff-review/session/";
    const REVIEW_ID = "dsh-demo-diff-review";
    const REVIEW_KIND = "demo-diff-review";

    function reviewAddress(sessionId, seq, index) {
      return REVIEW_ADDRESS + encodeURIComponent(sessionId) + "/" + seq + "/" + index;
    }
    function parseReviewAddress(address) {
      if (typeof address !== "string" || !address.startsWith(REVIEW_ADDRESS)) return undefined;
      const parts = address.slice(REVIEW_ADDRESS.length).split("/");
      if (parts.length !== 3) return undefined;
      const [rawSession, rawSeq, rawIndex] = parts;
      if (rawSession === "") return undefined;
      const seq = Number(rawSeq);
      const index = Number(rawIndex);
      if (!Number.isSafeInteger(seq) || seq < 1 || !Number.isSafeInteger(index) || index < 0) return undefined;
      try {
        return { sessionId: decodeURIComponent(rawSession), seq, index };
      } catch {
        return undefined;
      }
    }

    // ── light validation of the `workspace/changes` event data ───────────────
    function isChangesEvent(data) {
      return data !== null && typeof data === "object" && Number.isSafeInteger(data.turn) && data.turn >= 1;
    }

    // ── event folding: capture the turn's `workspace/changes` sequence ───────
    const changesDefinition = {
      kind: "demo-diff",
      match(event) {
        if (event.type === "turn/start") return { id: String(event.data.turn), role: "start" };
        if (event.type === "workspace/changes") return isChangesEvent(event.data) ? { id: String(event.data.turn), role: "update" } : null;
        return null;
      },
      start(_context, match) {
        return { turn: match.event.data.turn };
      },
      update(context, match) {
        if (match.event.type === "workspace/changes") return { ...context.state, seq: match.event.seq };
        return context.state;
      },
      buildLocationData(context, scope, previous) {
        if (scope !== "turn" || context.state === undefined) return null;
        if (previous && previous.kind === "turn" && previous.turn === context.state.turn && previous.key === "demo-diff" && previous.value.seq === context.state.seq) return previous;
        return { kind: "turn", turn: context.state.turn, key: "demo-diff", value: { seq: context.state.seq } };
      },
    };

    // ── our own syntax highlighter ──────────────────────────────────────────
    const KEYWORD_RE = /\b(const|let|var|function|return|if|else|import|export|from|async|await|class|new)\b/g;
    function highlight(text) {
      KEYWORD_RE.lastIndex = 0;
      const parts = [];
      let last = 0;
      let key = 0;
      let m;
      while ((m = KEYWORD_RE.exec(text)) !== null) {
        if (m.index > last) parts.push(React.createElement("span", { key: key++ }, text.slice(last, m.index)));
        parts.push(React.createElement("span", { key: key++, style: { color: "#7dd3fc", fontWeight: 600 } }, m[0]));
        last = m.index + m[0].length;
      }
      if (last < text.length) parts.push(React.createElement("span", { key: key++ }, text.slice(last)));
      return parts;
    }

    // ── styles ──────────────────────────────────────────────────────────────
    const S = {
      card: { margin: "8px 0", border: "1px solid rgba(128,128,128,0.35)", borderRadius: "8px", overflow: "hidden", fontSize: "12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
      panel: { height: "100%", overflow: "auto", fontSize: "12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
      head: { padding: "6px 10px", background: "rgba(128,128,128,0.12)", fontSize: "11px", borderBottom: "1px solid rgba(128,128,128,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" },
      file: { padding: "4px 10px", display: "flex", justifyContent: "space-between", gap: "12px", cursor: "pointer", borderTop: "1px solid rgba(128,128,128,0.12)", color: "inherit" },
      counts: { opacity: 0.75, flexShrink: 0 },
      add: { color: "#4ade80" },
      del: { color: "#f87171" },
      code: { whiteSpace: "pre", padding: "0 10px 0 6px", lineHeight: "1.55" },
      num: { display: "inline-block", width: "2.6em", textAlign: "right", paddingRight: "0.9em", opacity: 0.45, userSelect: "none", flexShrink: 0 },
      sign: { display: "inline-block", width: "1.1em", userSelect: "none", flexShrink: 0, color: "rgba(160,160,160,0.9)" },
      hunk: { padding: "2px 10px", background: "rgba(96,165,250,0.10)", color: "#93c5fd", fontSize: "11px", userSelect: "none" },
      btn: { border: "1px solid rgba(128,128,128,0.4)", borderRadius: "5px", background: "transparent", color: "inherit", padding: "1px 8px", fontSize: "11px", cursor: "pointer" },
      empty: { padding: "10px", opacity: 0.7 },
    };

    function lineBg(kind) {
      if (kind === "add") return { background: "rgba(34,197,94,0.16)" };
      if (kind === "del") return { background: "rgba(239,68,68,0.18)" };
      return {};
    }
    function signFor(line) {
      const c = line.charCodeAt(0);
      return c === 43 ? "+" : c === 45 ? "-" : " ";
    }
    function kindFor(line) {
      const c = line.charCodeAt(0);
      return c === 43 ? "add" : c === 45 ? "del" : "context";
    }

    function expandHunk(hunk) {
      const rows = [];
      let oldNo = hunk.oldStart;
      let newNo = hunk.newStart;
      for (const line of hunk.lines) {
        const kind = kindFor(line);
        rows.push({ kind, sign: signFor(line), text: line.slice(1), oldNo: kind === "add" ? null : oldNo, newNo: kind === "del" ? null : newNo });
        if (kind !== "add") oldNo += 1;
        if (kind !== "del") newNo += 1;
      }
      return rows;
    }

    function Unified({ hunks }) {
      const blocks = [];
      hunks.forEach((hunk, hi) => {
        blocks.push(React.createElement("div", { key: "h" + hi, style: S.hunk },
          "@@ -" + hunk.oldStart + "," + hunk.oldLines + " +" + hunk.newStart + "," + hunk.newLines + " @@"));
        expandHunk(hunk).forEach((row, ri) => {
          blocks.push(React.createElement("div", { key: hi + "-" + ri, style: { display: "flex", alignItems: "baseline", ...lineBg(row.kind) } },
            React.createElement("span", { style: S.num }, row.oldNo ?? ""),
            React.createElement("span", { style: S.num }, row.newNo ?? ""),
            React.createElement("span", { style: S.sign }, row.sign),
            React.createElement("span", { style: S.code }, highlight(row.text))));
        });
      });
      return React.createElement("div", null, blocks);
    }

    function SideBySide({ hunks }) {
      const rows = [];
      hunks.forEach((hunk, hi) => {
        rows.push(React.createElement("div", { key: "h" + hi, style: { ...S.hunk, gridColumn: "1 / -1" } },
          "@@ -" + hunk.oldStart + "," + hunk.oldLines + " +" + hunk.newStart + "," + hunk.newLines + " @@"));
        expandHunk(hunk).forEach((r, ri) => {
          const left = r.kind === "add" ? null : r;
          const right = r.kind === "del" ? null : r;
          rows.push(React.createElement("div", { key: hi + "-" + ri, style: { display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid rgba(128,128,128,0.08)" } },
            React.createElement("div", { style: { display: "flex", alignItems: "baseline", ...(left ? lineBg(left.kind) : {}) } },
              React.createElement("span", { style: S.num }, left ? left.oldNo : ""),
              React.createElement("span", { style: S.sign }, left ? left.sign : ""),
              React.createElement("span", { style: S.code }, left ? highlight(left.text) : "")),
            React.createElement("div", { style: { display: "flex", alignItems: "baseline", ...(right ? lineBg(right.kind) : {}) } },
              React.createElement("span", { style: S.num }, right ? right.newNo : ""),
              React.createElement("span", { style: S.sign }, right ? right.sign : ""),
              React.createElement("span", { style: S.code }, right ? highlight(right.text) : ""))));
        });
      });
      return React.createElement("div", null, rows);
    }

    function DiffView({ diff }) {
      const [view, setView] = useState("unified");
      if (diff.kind !== "text") {
        return React.createElement("div", { style: S.empty }, diff.kind === "binary" ? "Binary file — changes cannot be shown" : "File too large — changes cannot be shown");
      }
      if (diff.coarse) {
        return React.createElement("div", { style: S.empty }, "Line comparison timed out; shown as a whole-file replacement.");
      }
      return React.createElement("div", null,
        React.createElement("div", { style: { padding: "4px 10px", display: "flex", gap: "8px", alignItems: "center" } },
          React.createElement("button", { style: S.btn, onClick: () => setView("unified") }, "Unified"),
          React.createElement("button", { style: S.btn, onClick: () => setView("split") }, "Side-by-side"),
          React.createElement("span", { style: { marginLeft: "auto", opacity: 0.6 } }, diff.display)),
        view === "unified" ? React.createElement(Unified, { hunks: diff.hunks }) : React.createElement(SideBySide, { hunks: diff.hunks }));
    }

    // ── turn-tail card: file list; a click opens the sidebar tab ────────────
    function DemoDiffPanel(props) {
      const sessionId = props.sessionId;
      const openReview = props.openReview;
      const turn = props.turn;
      const seq = turn && turn.data ? turn.data.get("demo-diff")?.seq : undefined;

      const [summary, setSummary] = useState(undefined);

      useEffect(() => {
        if (sessionId === undefined || seq === undefined) return;
        let cancelled = false;
        setSummary(undefined);
        fetch(summaryUrl(sessionId, seq))
          .then((r) => (r.ok ? r.json() : null))
          .then((value) => { if (!cancelled) setSummary(value); })
          .catch(() => { if (!cancelled) setSummary(null); });
        return () => { cancelled = true; };
      }, [sessionId, seq]);

      if (seq === undefined) return null;
      if (summary === undefined) {
        return React.createElement("div", { style: S.card }, React.createElement("div", { style: S.head }, "Custom diff panel — loading…"));
      }
      if (summary === null || !Array.isArray(summary.files) || summary.files.length === 0) {
        return React.createElement("div", { style: S.card }, React.createElement("div", { style: S.head }, "Custom diff panel — no change summary for this turn"));
      }

      const files = summary.files;
      const children = [];
      children.push(React.createElement("div", { key: "head", style: S.head },
        React.createElement("span", null, "Custom diff panel — " + files.length + " file(s) · click a file to open the diff in the side panel"),
        React.createElement("span", { style: { opacity: 0.6 } }, "+" + summary.added + " / -" + summary.deleted)));

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        children.push(React.createElement("div", {
          key: i,
          style: S.file,
          onClick: () => openReview(sessionId, seq, i),
        },
          React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, file.display),
          React.createElement("span", { style: S.counts },
            React.createElement("span", { style: S.add }, "+" + file.added),
            " ",
            React.createElement("span", { style: S.del }, "-" + file.deleted))));
      }

      return React.createElement("div", { style: S.card }, children);
    }

    // ── right-sidebar tab body ──────────────────────────────────────────────
    function ReviewTab(props) {
      const { tab } = props.useTabInfo();
      const coords = useMemo(() => parseReviewAddress(tab.contentId), [tab.contentId]);
      const sessionId = coords ? coords.sessionId : undefined;
      const seq = coords ? coords.seq : undefined;

      const [summary, setSummary] = useState(undefined);
      const [index, setIndex] = useState(coords ? coords.index : 0);
      const [diff, setDiff] = useState(undefined);
      const [loading, setLoading] = useState(false);

      useEffect(() => {
        if (sessionId === undefined || seq === undefined) return;
        let cancelled = false;
        setSummary(undefined);
        fetch(summaryUrl(sessionId, seq))
          .then((r) => (r.ok ? r.json() : null))
          .then((value) => { if (!cancelled) setSummary(value); })
          .catch(() => { if (!cancelled) setSummary(null); });
        return () => { cancelled = true; };
      }, [sessionId, seq]);

      useEffect(() => {
        if (sessionId === undefined || seq === undefined) return;
        let cancelled = false;
        setDiff(undefined);
        setLoading(true);
        fetch(diffUrl(sessionId, seq, index))
          .then((r) => (r.ok ? r.json() : null))
          .then((value) => { if (!cancelled) { setDiff(value); setLoading(false); } })
          .catch(() => { if (!cancelled) { setDiff(null); setLoading(false); } });
        return () => { cancelled = true; };
      }, [sessionId, seq, index]);

      if (coords === undefined) {
        return React.createElement("div", { style: S.empty }, "Invalid review address");
      }

      const files = summary && Array.isArray(summary.files) ? summary.files : [];
      const children = [];

      children.push(React.createElement("div", { key: "head", style: S.head },
        React.createElement("span", null, "Diff review — turn " + seq),
        React.createElement("span", { style: { opacity: 0.6 } }, summary ? "+" + summary.added + " / -" + summary.deleted : "")));

      if (summary === undefined) {
        children.push(React.createElement("div", { key: "loading", style: S.empty }, "Loading summary…"));
      } else if (summary === null || files.length === 0) {
        children.push(React.createElement("div", { key: "none", style: S.empty }, "No change summary for this turn"));
      } else {
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          children.push(React.createElement("div", {
            key: "f" + i,
            style: { ...S.file, ...(i === index ? { background: "rgba(96,165,250,0.12)" } : {}) },
            onClick: () => setIndex(i),
          },
            React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, file.display),
            React.createElement("span", { style: S.counts },
              React.createElement("span", { style: S.add }, "+" + file.added),
              " ",
              React.createElement("span", { style: S.del }, "-" + file.deleted))));
        }
        children.push(React.createElement("div", { key: "diff", style: { borderTop: "1px solid rgba(128,128,128,0.2)" } },
          loading || diff === undefined
            ? React.createElement("div", { style: S.empty }, "Loading comparison…")
            : diff === null
              ? React.createElement("div", { style: S.empty }, "Comparison unavailable")
              : React.createElement(DiffView, { diff })));
      }

      return React.createElement("div", { style: S.panel }, children);
    }

    // ── tab-type registry definition ────────────────────────────────────────
    function reviewDefinition() {
      return {
        id: REVIEW_ID,
        kind: REVIEW_KIND,
        patterns: ["dsh-resource://demo-diff-review/**"],
        priority: "builtin",
        canOpen: (address) => parseReviewAddress(address) !== undefined,
        title: (address) => {
          const coords = parseReviewAddress(address);
          return coords === undefined ? "Diff review" : "Diff review (turn " + coords.seq + ")";
        },
      };
    }

    // ── plugin body ─────────────────────────────────────────────────────────
    function apply(ctx) {
      ctx.effect(() => ctx.uiConversation.events.register(changesDefinition), "demo-diff: changes folding");
      ctx.effect(() => ctx.sidebarRightTabs.register(reviewDefinition()), "demo-diff: review tab type");
      ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () =>
        ctx.slots.register({
          name: "sidebar.right.pane.tab",
          key: REVIEW_ID,
          inject: () => ({}),
        }, ReviewTab),
      ), "demo-diff: review tab body");
      ctx.effect(() => ctx.slots.inject("conversation.chat.turnTail", () =>
        ctx.slots.register({
          name: "conversation.chat.turnTail",
          id: "dsh-code-diff-highlight",
          inject: () => ({
            openReview: (sessionId, seq, index) => {
              ctx.sidebarRight.openResource(reviewAddress(sessionId, seq, index));
            },
          }),
        }, DemoDiffPanel),
      ), "demo-diff: turn-tail entry");
    }

    const inject = ["slots", "uiConversation", "sidebarRight", "sidebarRightTabs"];

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
