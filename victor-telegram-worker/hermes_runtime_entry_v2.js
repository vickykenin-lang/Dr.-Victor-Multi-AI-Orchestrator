import primaryWorker from './llm_first_runtime.js';
import { handleGulaboCommandRequest } from './hermes_gulabo_command_http.mjs';
import { handleHermesHttpRequestV2 } from './hermes_command_http_v2.mjs';

export default {
  async scheduled(controller, env, ctx) {
    return primaryWorker.scheduled(controller, env, ctx);
  },
  async fetch(request, env, ctx) {
    const gulaboHandled = await handleGulaboCommandRequest(request, env);
    if (gulaboHandled) return gulaboHandled;
    const handled = await handleHermesHttpRequestV2(request, env);
    if (handled) return handled;
    return primaryWorker.fetch(request, env, ctx);
  },
  async queue(batch, env, ctx) {
    return primaryWorker.queue(batch, env, ctx);
  },
};
