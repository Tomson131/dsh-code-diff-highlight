// Node half of the demo plugin — no host-side work is required.
//
// Its presence makes the Loader row a valid, activated plugin. The browser
// half is discovered separately by `dsh-client-modules`, which reads this
// package's `dsh.client` declaration and serves `./client` at
// `/plugins/dsh-code-diff-highlight/client.js`.
//
// A real host half could register API routes, tools, system-prompt sections,
// or services here; this demo leaves it empty.

const inject = [];

function apply() {}

export { apply, inject };
