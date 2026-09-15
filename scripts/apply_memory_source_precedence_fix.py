from pathlib import Path

fact_path = Path('brain/fact_runtime.mjs')
worker_path = Path('victor-telegram-worker/worker.js')

fact = fact_path.read_text(encoding='utf-8')
old = "You are Victor answering the Founder from freshly retrieved GitHub evidence."
new = "You are Victor answering the Founder from the verified evidence provided below. GitHub is canonical when it contains an explicit fact; Cognee long-term memory may supply a noncanonical remembered fact when GitHub is silent. Absence from a registry, file, or department list is not a conflict with a remembered fact unless the canonical source explicitly states a contradictory value or rule."
if old in fact:
    fact = fact.replace(old, new, 1)
elif new not in fact:
    raise RuntimeError('FACT_PROMPT_ANCHOR_NOT_FOUND')
fact_path.write_text(fact, encoding='utf-8')

worker = worker_path.read_text(encoding='utf-8')
old_system = "Answer from verified evidence. GitHub canonical evidence has precedence. Cognee long-term memory may be used when it directly answers the Founder query and does not conflict with canonical evidence. Never claim a Cognee memory is canonical unless GitHub also supports it. If neither source supports the answer, say UNVERIFIED."
new_system = "Answer from the verified evidence provided. GitHub canonical evidence has precedence only when it contains an explicit relevant fact or an explicit contradiction. Cognee long-term memory is valid remembered evidence when it directly answers the Founder query and GitHub is silent. Mere absence from a department registry, file, or canonical source is NOT a conflict and must not cause UNVERIFIED if Cognee contains a direct matching memory. Never call Cognee canonical unless GitHub also supports it. If Cognee directly contains the requested remembered fact and there is no explicit canonical contradiction, answer that fact naturally and identify it as remembered long-term memory when provenance matters. If neither source supports the answer, say UNVERIFIED."
if old_system in worker:
    worker = worker.replace(old_system, new_system, 1)
elif new_system not in worker:
    raise RuntimeError('WORKER_MEMORY_PRECEDENCE_PROMPT_ANCHOR_NOT_FOUND')
worker_path.write_text(worker, encoding='utf-8')

print('MEMORY_SOURCE_PRECEDENCE_FIX_APPLIED')
