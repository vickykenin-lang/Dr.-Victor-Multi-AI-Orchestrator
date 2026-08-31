#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
bridge=ROOT/'victor-telegram-worker/department_bridge.mjs'
worker=ROOT/'victor-telegram-worker/worker.js'

b=bridge.read_text(encoding='utf-8')
b=b.replace("  if (/certif|bridge|connect|communication|strict|supervision/.test(value)) return 'STRICT_SUPERVISION_PROBE';", "  if (/recover|recovery|thik|fix|repair|production.?ready|system.*(thik|fix)/.test(value)) return 'RECOVERY_EXECUTE';\n  if (/certif|bridge|connect|communication|strict|supervision/.test(value)) return 'STRICT_SUPERVISION_PROBE';")
b=b.replace("return /status|report|error|problem|issue|check|pucho|pooch|baat|connect|bridge|communication|certif|supervision|progress|objective/.test(value);", "return /status|report|error|problem|issue|check|pucho|pooch|baat|connect|bridge|communication|certif|supervision|progress|objective|recover|recovery|thik|fix|repair|production.?ready|system/.test(value);")
if "RECOVERY_EXECUTE" not in b.split('export function selectAura3TaskType',1)[1].split('}',1)[0]:
    raise SystemExit('AURA3_RECOVERY_ROUTING_PATCH_FAILED')
bridge.write_text(b,encoding='utf-8')

w=worker.read_text(encoding='utf-8')
if "'/aura3-bridge-health'" not in w:
    anchor="""    if (request.method === 'GET' && ['/tony-bridge-health', '/tony-bridge-health/', '/tony-health', '/tony-health/'].includes(url.pathname)) {
"""
    if anchor not in w: raise SystemExit('TONY_HEALTH_ANCHOR_NOT_FOUND')
    block="""    if (request.method === 'GET' && ['/aura3-bridge-health', '/aura3-bridge-health/', '/aura3-health', '/aura3-health/'].includes(url.pathname)) {
      if (!aura3BridgeConfigured(env)) {
        return json({ service: 'aura3-bridge', status: 'PENDING_CONFIGURATION', token_present: false }, 503);
      }
      const headers = {
        Authorization: `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Dr-Victor-AURA3-Bridge-Health/1.0',
      };
      const repoUrl = 'https://api.github.com/repos/vickykenin-lang/aura-3.0';
      const workflowUrl = 'https://api.github.com/repos/vickykenin-lang/aura-3.0/actions/workflows/victor-aura3-transport.yml';
      const [repoResponse, workflowResponse] = await Promise.all([
        fetch(repoUrl, { headers }),
        fetch(workflowUrl, { headers }),
      ]);
      return json({
        service: 'aura3-bridge',
        status: repoResponse.ok && workflowResponse.ok ? 'READ_PATH_VERIFIED' : 'BLOCKED',
        token_present: true,
        repository_access_http: repoResponse.status,
        workflow_access_http: workflowResponse.status,
        workflow_dispatch_write: 'NOT_TESTED_BY_READ_ONLY_HEALTH_CHECK',
        expected_actions_permission: 'READ_AND_WRITE',
        expected_contents_permission: 'READ_ONLY_OR_HIGHER',
        secrets_exposed: false,
      }, repoResponse.ok && workflowResponse.ok ? 200 : 503);
    }

"""
    w=w.replace(anchor,block+anchor,1)
worker.write_text(w,encoding='utf-8')
print('AURA3_TRANSPORT_RUNTIME_PATCHED')
