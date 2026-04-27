export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Follow Next's instrumentation guidance: dispatch Node-only startup
    // code through require so the Edge instrumentation bundle does not trace
    // Prisma or other Node-only modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerNodeInstrumentation } = require("./instrumentation.node");
    await registerNodeInstrumentation();
  }
}
