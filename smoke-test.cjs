// Smoke test: simulate the browser module-loader environment in Node to verify
// the demo client bundle registers its event folding, tab type, and slot bodies.
const fs = require("fs");
const path = require("path");

const React = {
  createElement: (...args) => ({ $$react: args }),
  useState: (init) => [init, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
};

let loadResult = null;
global.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      const fakeRequire = (name) => {
        if (name === "react") return React;
        throw new Error("unexpected require: " + name);
      };
      loadResult = factory(fakeRequire);
      console.log("loaded bundle id:", id);
    },
  },
};

const src = fs.readFileSync(path.join(__dirname, "lib", "client.js"), "utf8");
new Function(src)();

console.log("exports:", Object.keys(loadResult));
const expectInject = "slots,uiConversation,sidebarRight,sidebarRightTabs";
if (loadResult.inject.join(",") !== expectInject) {
  console.error("FAIL: inject =", loadResult.inject, "(expected", expectInject + ")");
  process.exit(1);
}

const calls = { events: null, tabType: null, slots: [], effects: [], opened: null };
const ctx = {
  effect(fn, label) {
    calls.effects.push(label);
    const disposer = fn();
    return typeof disposer === "function" ? disposer : undefined;
  },
  uiConversation: {
    events: {
      register(def) {
        calls.events = def;
        return () => {};
      },
    },
  },
  sidebarRightTabs: {
    register(def) {
      calls.tabType = def;
      return () => {};
    },
  },
  sidebarRight: {
    openResource(address) {
      calls.opened = address;
      return true;
    },
  },
  slots: {
    inject(slot, cb) {
      return cb();
    },
    register(def, Component) {
      calls.slots.push({ def, component: typeof Component });
    },
  },
};

loadResult.apply(ctx);

console.log("effects:", JSON.stringify(calls.effects));
console.log("events def kind:", calls.events && calls.events.kind);
console.log("tab type:", calls.tabType && JSON.stringify({ id: calls.tabType.id, kind: calls.tabType.kind, patterns: calls.tabType.patterns }));
console.log("slot registrations:", JSON.stringify(calls.slots.map((s) => ({ slot: s.def.name, key: s.def.key, id: s.def.id, component: s.component }))));

// Exercise the turn-tail openReview injection and the sidebar tab title/canOpen.
const turnTail = calls.slots.find((s) => s.def.name === "conversation.chat.turnTail");
const tabBody = calls.slots.find((s) => s.def.name === "sidebar.right.pane.tab");

const ok =
  calls.events && calls.events.kind === "demo-diff" &&
  calls.tabType && calls.tabType.id === "dsh-demo-diff-review" &&
  turnTail && turnTail.component === "function" &&
  tabBody && tabBody.component === "function" && tabBody.def.key === "dsh-demo-diff-review" &&
  calls.tabType.canOpen("dsh-resource://demo-diff-review/session/s1/7/0") === true &&
  calls.tabType.canOpen("dsh-resource://other/x") === false;

console.log(ok ? "OK" : "FAIL");
process.exit(ok ? 0 : 1);
