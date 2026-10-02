import primaryWorker from './worker.js';
import { handleHermesHttpRequestV2 } from './hermes_command_http_v2.mjs';

export default {
  async scheduled(controller, env, ctx) {
    return primaryWorker.scheduled(controller, env, ctx);
  },
  async fetch(request, env, ctx) {
    const handled = await handleHermesHttpRequestV2(request, env);
    if (handled) return handled;
    return primaryWorker.fetch(request, env, ctx);
  },
};
