from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    return text.replace(old, new, 1)


worker_path = Path('victor-telegram-worker/worker.js')
worker = worker_path.read_text()

worker = replace_once(
    worker,
    "import { cogneeRecall } from './cognee_memory_bridge.mjs';\n",
    "import { cogneeRecall } from './cognee_memory_bridge.mjs';\nimport { endgameRuntimeHealth, runEndgameRuntimeAcceptance } from './endgame_runtime_acceptance.mjs';\n",
    'worker import',
)

worker = replace_once(
    worker,
    "        cognee_inference_runtime: 'COGNEE_CLOUD_MEMORY_API_V2',\n",
    "        cognee_inference_runtime: 'COGNEE_CLOUD_MEMORY_API_V2',\n        endgame_runtime_package: 'PACKAGE2_LIVE_ACCEPTANCE_V1',\n        endgame_runtime_health: endgameRuntimeHealth(env),\n",
    'health package2 fields',
)

worker = replace_once(
    worker,
    "      const watchdog = evaluateWatchdog({ heartbeat_age_seconds: 0 });\n      const ready = stopTest.intent === V2_FOUNDER_INTENT.STOP_PAUSE\n",
    "      const watchdog = evaluateWatchdog({ heartbeat_age_seconds: 0 });\n      const endgame = endgameRuntimeHealth(env);\n      const ready = stopTest.intent === V2_FOUNDER_INTENT.STOP_PAUSE\n",
    'v2 health endgame selftest',
)

worker = replace_once(
    worker,
    "        production_autonomy_enabled: false,\n        live_sandbox_execution_verified: false,\n",
    "        production_autonomy_enabled: false,\n        endgame_runtime_status: endgame.status,\n        endgame_verified_procedure: endgame.verified_procedure,\n        endgame_degraded_mode: endgame.degraded_mode,\n        endgame_truthful_telemetry_surface: endgame.truthful_telemetry_surface,\n        endgame_experience_ledger_durable: endgame.experience_ledger_durable,\n        endgame_cognee_memory_status: endgame.cognee_memory_status,\n        live_sandbox_execution_verified: false,\n",
    'v2 health response fields',
)

endpoint = """    if (request.method === 'GET' && url.pathname === '/endgame-runtime-health') {
      const health = endgameRuntimeHealth(env);
      return json(health, health.status === 'READY' ? 200 : 503);
    }

"""
worker = replace_once(
    worker,
    "    if (request.method !== 'POST' || url.pathname !== '/telegram') return json({ error: 'not_found' }, 404);\n",
    endpoint + "    if (request.method !== 'POST' || url.pathname !== '/telegram') return json({ error: 'not_found' }, 404);\n",
    'endgame health endpoint',
)

acceptance = """    if (/^\\s*ENDGAME RUNTIME ACCEPTANCE\\s*$/i.test(text)) {
      const acceptance = await runEndgameRuntimeAcceptance(env, {
        traceId,
        query: 'Falcon validation code',
      });
      const reply = [
        `END GAME Package 2: ${acceptance.status}`,
        `Verified procedure/degraded mode: ${acceptance.procedure_registry_live ? 'VERIFIED' : 'BLOCKED'}`,
        `Truthful telemetry: ${acceptance.truthful_telemetry_live ? 'VERIFIED' : 'BLOCKED'}`,
        `Experience ledger round-trip: ${acceptance.experience_ledger_readback_verified ? 'VERIFIED' : 'BLOCKED'}`,
        `Experience advisory reuse: ${acceptance.experience_advisory_reuse_verified ? 'VERIFIED' : 'BLOCKED'}`,
        `Cognee semantic round-trip: ${acceptance.cognee_semantic_roundtrip_verified ? 'VERIFIED' : 'BLOCKED'}`,
        `Blockers: ${acceptance.blockers.length ? acceptance.blockers.join(', ') : 'none'}`,
        'Production autonomy: OFF',
        'Secrets exposed: no',
      ].join('\\n');
      await sendTelegramMessage(env, chatId, reply, message.message_id);
      return json({ ok: acceptance.status === 'PASS', mode: 'ENDGAME_RUNTIME_ACCEPTANCE', ...acceptance }, 200);
    }

"""
worker = replace_once(
    worker,
    "    const emergencyCommand = parseEmergencyCommand(text);\n",
    acceptance + "    const emergencyCommand = parseEmergencyCommand(text);\n",
    'founder package2 acceptance command',
)

worker_path.write_text(worker)

workflow_path = Path('.github/workflows/victor_v2_block5_production_deploy.yml')
workflow = workflow_path.read_text()
workflow = replace_once(
    workflow,
    "    paths:\n      - '.github/workflows/victor_v2_block5_production_deploy.yml'\n",
    "    paths:\n      - '.github/workflows/victor_v2_block5_production_deploy.yml'\n      - 'victor-telegram-worker/worker.js'\n      - 'victor-telegram-worker/endgame_runtime_acceptance.mjs'\n      - 'brain/endgame_runtime_gate.mjs'\n      - 'brain/procedure_registry.mjs'\n      - 'brain/degraded_mode.mjs'\n      - 'brain/truthful_telemetry.mjs'\n      - 'brain/experience_ledger.mjs'\n",
    'deploy push paths',
)
workflow = replace_once(
    workflow,
    "      WORKER_BASE_URL: https://victor-telegram-webhook.vickykenin.workers.dev\n",
    "      WORKER_BASE_URL: https://victor-telegram-webhook.vickykenin.workers.dev\n      TELEGRAM_WEBHOOK_SECRET: ${{ secrets.TELEGRAM_WEBHOOK_SECRET }}\n      VICTOR_FOUNDER_CHAT_ID: ${{ secrets.VICTOR_FOUNDER_CHAT_ID }}\n",
    'deploy acceptance secrets',
)
workflow = replace_once(
    workflow,
    "          node --test brain/founder_intent_gateway.test.mjs brain/security_kernel.test.mjs brain/action_contract.test.mjs brain/block3_sandbox_security.test.mjs brain/block4_promotion_shadow.test.mjs brain/block5_redteam_security.test.mjs\n",
    "          node --test brain/founder_intent_gateway.test.mjs brain/security_kernel.test.mjs brain/action_contract.test.mjs brain/block3_sandbox_security.test.mjs brain/block4_promotion_shadow.test.mjs brain/block5_redteam_security.test.mjs victor-telegram-worker/endgame_runtime_acceptance.test.mjs\n",
    'deploy regression package2 test',
)
workflow = replace_once(
    workflow,
    "          required=['/health','/v2-health','/core-health','/aura3-bridge-health','/tony-bridge-health','/telegram-webhook-health']\n",
    "          required=['/health','/v2-health','/endgame-runtime-health','/core-health','/aura3-bridge-health','/tony-bridge-health','/telegram-webhook-health']\n",
    'deploy live endpoint list',
)
workflow = replace_once(
    workflow,
    "          assert v2.get('production_autonomy_enabled') is False, v2\n          health=results['/health']['body']\n",
    "          assert v2.get('production_autonomy_enabled') is False, v2\n          endgame=results['/endgame-runtime-health']['body']\n          assert endgame.get('status')=='READY', endgame\n          assert endgame.get('degraded_mode')=='DEGRADED_VERIFIED_PROCEDURE', endgame\n          assert endgame.get('truthful_telemetry_surface')=='LIVE', endgame\n          assert endgame.get('production_autonomy_enabled') is False, endgame\n          health=results['/health']['body']\n",
    'deploy endgame endpoint asserts',
)

live_step = r'''      - name: Founder-authorized END GAME Package 2 live acceptance
        shell: bash
        run: |
          python - <<'PY'
          import json, os, urllib.request
          if not os.environ.get('TELEGRAM_WEBHOOK_SECRET') or not os.environ.get('VICTOR_FOUNDER_CHAT_ID'):
              raise SystemExit('Protected Founder acceptance secrets are not configured')
          base=os.environ['WORKER_BASE_URL'].rstrip('/')
          founder=str(os.environ['VICTOR_FOUNDER_CHAT_ID'])
          payload={
              'update_id': 926092502,
              'message': {
                  'message_id': 0,
                  'from': {'id': int(founder)},
                  'chat': {'id': int(founder), 'type': 'private'},
                  'text': 'ENDGAME RUNTIME ACCEPTANCE',
              },
          }
          req=urllib.request.Request(
              base+'/telegram',
              data=json.dumps(payload).encode(),
              method='POST',
              headers={
                  'Content-Type':'application/json',
                  'X-Telegram-Bot-Api-Secret-Token':os.environ['TELEGRAM_WEBHOOK_SECRET'],
                  'User-Agent':'Victor-ENDGAME-Package2-Live-Acceptance/1.0',
              },
          )
          with urllib.request.urlopen(req,timeout=45) as r:
              body=json.loads(r.read().decode())
              code=r.status
          safe={
              'http_status':code,
              'mode':body.get('mode'),
              'status':body.get('status'),
              'procedure_registry_live':body.get('procedure_registry_live'),
              'degraded_mode_live':body.get('degraded_mode_live'),
              'truthful_telemetry_live':body.get('truthful_telemetry_live'),
              'experience_ledger_readback_verified':body.get('experience_ledger_readback_verified'),
              'experience_advisory_reuse_verified':body.get('experience_advisory_reuse_verified'),
              'cognee_semantic_roundtrip_verified':body.get('cognee_semantic_roundtrip_verified'),
              'cognee_result_count':body.get('cognee_result_count'),
              'blockers':body.get('blockers'),
              'production_autonomy_enabled':body.get('production_autonomy_enabled'),
              'secrets_exposed':body.get('secrets_exposed'),
          }
          print(json.dumps(safe,indent=2))
          assert code==200, safe
          assert body.get('mode')=='ENDGAME_RUNTIME_ACCEPTANCE', safe
          assert body.get('status')=='PASS', safe
          assert body.get('procedure_registry_live') is True, safe
          assert body.get('degraded_mode_live') is True, safe
          assert body.get('truthful_telemetry_live') is True, safe
          assert body.get('experience_ledger_readback_verified') is True, safe
          assert body.get('experience_advisory_reuse_verified') is True, safe
          assert body.get('cognee_semantic_roundtrip_verified') is True, safe
          assert body.get('production_autonomy_enabled') is False, safe
          assert body.get('secrets_exposed') is False, safe
          PY
'''
needle = "          print(json.dumps({'status':'LIVE_V2_RUNTIME_VERIFIED','source_git_sha':os.environ.get('GITHUB_SHA'),'results':results},indent=2))\n          PY\n"
workflow = replace_once(workflow, needle, needle + live_step, 'deploy package2 live acceptance step')
workflow_path.write_text(workflow)

print('PACKAGE2_RUNTIME_WIRING_APPLIED')
