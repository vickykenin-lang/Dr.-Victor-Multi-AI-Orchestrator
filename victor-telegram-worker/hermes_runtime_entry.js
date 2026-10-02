import primaryWorker from './worker.js';
import { handleHermesHttpRequest, hermesHttpCapability } from './hermes_command_http.mjs';

export default {
  async scheduled(controller, env, ctx) {
    return primaryWorker.scheduled(controller, env, ctx);
  },

  async fetch(request, env, ctx) {
    const hermesResponse = await handleHermesHttpRequest(request, env);
    if (hermesResponse) return hermesResponse;
    return primaryWorker.fetch(request, env, ctx);
  },
};

export { hermesHttpCapability };
