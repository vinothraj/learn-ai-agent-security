import type { Flashcard } from '@laas/shared';

type Card = [front: string, back: string];

/** Flashcards for the 2026.10.4 lessons (same id scheme as flashcards.ts). */
const deck: Record<string, Card[]> = {
  'a-threat-modeling-llm': [
    ['The four threat-modeling questions?', 'What are we building? What can go wrong? What will we do about it? Did we do a good job?'],
    ['STRIDE stands for…', 'Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.'],
    ['Prompt injection that triggers an admin tool maps to which STRIDE category?', 'Elevation of privilege (via tampering with the model\'s input).'],
    ['Two AI threat catalogues to add to STRIDE?', 'The OWASP Top 10 for LLM Applications and MITRE ATLAS.'],
  ],
  'a-secure-ai-lifecycle': [
    ['The four stages in the NCSC/CISA secure AI guidance?', 'Secure design, secure development, secure deployment, secure operation and maintenance.'],
    ['Why treat a system prompt change like a code change?', 'It can remove refusals or expose tools, so it needs review and regression tests.'],
    ['Supply-chain check for a downloaded model?', 'Verify its source and hash or signature before use.'],
    ['One operational control for AI features?', 'Monitor inputs, outputs and tool calls with alerting.'],
  ],
  'a-ai-risk-governance': [
    ['The four NIST AI RMF functions?', 'Govern, Map, Measure, Manage.'],
    ['What is NIST AI 600-1?', 'The Generative AI Profile of the AI RMF, listing GenAI-specific risks and actions.'],
    ['First governance artifact for a small team?', 'An inventory of AI features, models, vendors and data flows.'],
    ['What does a risk register entry need?', 'A description, owner, rating and treatment.'],
  ],
  'b-system-prompt-leakage': [
    ['OWASP LLM ID for system prompt leakage?', 'LLM07.'],
    ['What should never be in a system prompt?', 'Secrets, credentials and security logic such as authorization rules.'],
    ['Safe assumption about system prompts?', 'They will eventually be seen; treat them as public.'],
    ['Where do business rules like refund limits belong?', 'In deterministic server-side code, not in the prompt.'],
  ],
  'b-data-poisoning': [
    ['OWASP LLM ID for data and model poisoning?', 'LLM04.'],
    ['What is a model backdoor?', 'Hidden behaviour that activates only when a specific trigger appears.'],
    ['Three entry points for poisoned data?', 'Scraped web data, user feedback used for fine-tuning, third-party datasets or checkpoints (also RAG documents).'],
    ['Best way to spot behaviour changes after an update?', 'Run a fixed evaluation set before and after and compare.'],
  ],
  'b-vector-embedding-weaknesses': [
    ['OWASP LLM ID for vector and embedding weaknesses?', 'LLM08.'],
    ['Most common RAG security bug?', 'Retrieval without permission filters, leaking data across users or tenants.'],
    ['Where is the tenant filter enforced?', 'In the backend retrieval query, from the authenticated identity.'],
    ['What must happen when a source document is deleted?', 'Delete its embeddings from the vector store too.'],
  ],
  'b-misinformation': [
    ['OWASP LLM ID for misinformation?', 'LLM09.'],
    ['What is package hallucination?', 'A model suggests a non-existent package; attackers register that name with malware.'],
    ['Grounding means…', 'Answering from retrieved, trusted sources and citing them.'],
    ['Control against overreliance?', 'Label AI output and require human verification for high-stakes decisions.'],
  ],
  'b-unbounded-consumption': [
    ['OWASP LLM ID for unbounded consumption?', 'LLM10.'],
    ['What is "denial of wallet"?', 'Driving up pay-per-use costs until the service becomes unaffordable.'],
    ['Three limits for a public LLM endpoint?', 'Input size, output token cap, per-user rate limits (plus budgets with alerts).'],
    ['What is model extraction?', 'Querying a model at scale to copy its behaviour.'],
  ],
  'b-supply-chain': [
    ['OWASP LLM ID for supply chain?', 'LLM03.'],
    ['Why prefer safetensors over pickle?', 'Pickle files can execute code when loaded; safetensors only store tensors.'],
    ['What is an AI bill of materials?', 'An inventory of models, datasets, libraries and providers a system uses.'],
    ['Two checks before using an open-weights model?', 'Trusted publisher and verified hash or signature.'],
  ],
  'c-agent-identity': [
    ['Delegated authorization for agents means…', 'The agent acts with the signed-in user\'s scoped, short-lived permissions.'],
    ['What is a confused deputy?', 'A privileged component tricked into using its authority on behalf of someone who lacks it.'],
    ['Why avoid one shared service account for an agent?', 'A manipulated session could reach every user\'s data, and actions cannot be attributed.'],
    ['What should every agent tool call log?', 'Both the agent identity and the end user identity.'],
  ],
  'c-memory-poisoning': [
    ['What is memory poisoning?', 'Getting malicious instructions saved into an agent\'s long-term memory so they persist.'],
    ['Why is it worse than one-off injection?', 'It survives sessions and can affect future tasks or other users.'],
    ['Two controls for agent memory?', 'Scope memory per user and require confirmation for sensitive memories.'],
    ['What must memory never change?', 'Permissions, recipients or tool settings.'],
  ],
  'c-unsafe-tool-execution': [
    ['How to treat agent-generated code?', 'As untrusted code run in a disposable sandbox.'],
    ['Three sandbox restrictions?', 'No secrets, no host files, restricted network egress (plus CPU, memory and time limits).'],
    ['Alternative to a generic shell tool?', 'Narrow tools and allow-listed commands.'],
    ['What turns prompt injection into RCE?', 'Executing model-generated code or commands without isolation.'],
  ],
  'c-multi-agent-trust': [
    ['How should an agent treat messages from other agents?', 'As untrusted data subject to its own checks.'],
    ['What should travel with a delegated task?', 'The original user identity and limits.'],
    ['Who enforces authorization in a multi-agent chain?', 'Every agent, for its own actions.'],
    ['What supports accountability across agents?', 'End-to-end traces linking user, agents and tool calls.'],
  ],
  'c-agent-monitoring': [
    ['Most important agent event to log?', 'Each tool call with parameters, result, agent and user identity.'],
    ['What must logs not contain?', 'Secrets and unnecessary personal data.'],
    ['What is an agent kill switch?', 'A fast way to disable a tool or the agent during an incident.'],
    ['Two alert signals for agents?', 'Unusual tool use or new destinations, and spikes in denials.'],
  ],
  'd-test-case-design': [
    ['Parts of a good AI security test case?', 'Threat, preconditions, input, expected behaviour, evidence.'],
    ['Why repeat LLM tests?', 'Outputs are non-deterministic; one pass can hide a failure.'],
    ['Better than checking reply wording?', 'Asserting on effects such as tool calls and data access.'],
    ['Pass criteria for LLM tests are often expressed as…', 'A rate (e.g. 0 of 50) or a hard invariant enforced by code.'],
  ],
  'd-red-teaming': [
    ['What comes before any red-team activity?', 'Written authorization, agreed scope and rules of engagement.'],
    ['Where to red-team an agent ideally?', 'In staging with test accounts and synthetic data.'],
    ['Key metric per attack technique?', 'Success rate, with impact and the control that failed.'],
    ['What happens after fixes?', 'Retest to confirm the success rate dropped.'],
  ],
  'd-guardrail-evals': [
    ['Two metrics for a guardrail?', 'Attack bypass rate (false negatives) and false-positive rate on benign traffic.'],
    ['What goes in the attack set?', 'Realistic attacks plus paraphrases, encodings and multi-turn attempts.'],
    ['What goes in the benign set?', 'Real and near-boundary legitimate requests.'],
    ['Can a 99% guardrail replace approval for refunds?', 'No. Guardrails are one layer; keep architectural controls.'],
  ],
  'e-ai-security-roles': [
    ['Four things AI security interviews test?', 'Fundamentals, AI risk knowledge, practical judgement, communication.'],
    ['Strongest evidence of skill?', 'Concrete work: lab reports and write-ups of what you tested and fixed.'],
    ['What does an AI red teamer do?', 'Runs authorized adversarial tests and measures failures.'],
    ['How to close a skill gap before an interview?', 'Hands-on labs plus a short report you can walk through.'],
  ],
  'e-explaining-findings': [
    ['Structure for explaining a finding?', 'Context, issue, impact, evidence, recommendation, next step.'],
    ['STAR stands for…', 'Situation, Task, Action, Result.'],
    ['What do engineers need?', 'Reproduction steps, root cause and the exact fix.'],
    ['What do managers need?', 'Business impact, likelihood, effort and residual risk.'],
  ],
  'f-tool-calling': [
    ['Who executes a tool call?', 'The application. The model only proposes a structured call.'],
    ['The agent loop in one line?', 'Think, call a tool, read the result, decide the next step, until done or a limit.'],
    ['Where do parameter checks belong?', 'In the application code, before executing the tool.'],
    ['How to treat tool results?', 'As untrusted text before they go back into the context.'],
  ],
  'f-ml-lifecycle': [
    ['Pre-training vs fine-tuning?', 'Pre-training builds a base model from huge data; fine-tuning adapts it with smaller task data.'],
    ['What is inference?', 'Using a trained model to answer requests in production.'],
    ['Main risk in fine-tuning?', 'Poisoned training examples.'],
    ['Where do most product teams focus security?', 'Inference: inputs, outputs, tools and authorization.'],
  ],
  'f-embeddings': [
    ['What is an embedding?', 'A vector of numbers representing the meaning of a piece of text.'],
    ['Are embeddings encryption?', 'No. Text can often be partially reconstructed from them.'],
    ['Does similarity search respect permissions?', 'No. Add metadata filters for the caller\'s identity.'],
    ['How to protect embeddings of sensitive data?', 'Like the source data, and delete them when the source is deleted.'],
  ],
};

export const flashcards2: Flashcard[] = Object.entries(deck).flatMap(([lessonId, cards]) =>
  cards.map(([front, back], i) => ({ id: `${lessonId}-fc${i + 1}`, lessonId, front, back })),
);
