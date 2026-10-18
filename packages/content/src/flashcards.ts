import type { Flashcard } from '@laas/shared';

type Card = [front: string, back: string];

const deck: Record<string, Card[]> = {
  'a-trust-boundaries': [
    ['What is a trust boundary?', 'A point where data or control passes between components with different levels of trust, such as user to API or document to model.'],
    ['Is the LLM a security boundary?', 'No. Instructions and data share one context, so injected text can steer it. Enforce security in deterministic code.'],
    ['Name four boundaries in a RAG chatbot.', 'User to API, API to model, retrieved documents to model context, model output to downstream tools or APIs.'],
    ['First artifact of an LLM threat model?', 'A data-flow diagram with every component, data store and trust boundary marked.'],
  ],
  'a-least-privilege': [
    ['Define least privilege.', 'Each identity gets the minimum permissions it needs, for the shortest time needed.'],
    ['How does least privilege help against prompt injection?', 'It does not stop injection; it limits what a manipulated model can do (blast radius).'],
    ['Delegated access for AI assistants means…', 'The assistant acts with the signed-in user\'s own permissions, not a shared super-account.'],
    ['Two credential practices for AI tools?', 'Narrowly scoped tokens (read-only where possible) and short-lived credentials that rotate.'],
  ],
  'b-prompt-injection': [
    ['What is prompt injection?', 'Input that changes an LLM application\'s behavior in unintended ways, such as ignoring instructions, leaking data or misusing tools.'],
    ['OWASP LLM Top 10 ID for prompt injection?', 'LLM01.'],
    ['Can a system prompt fully prevent injection?', 'No. It is guidance, not enforcement. Use defense in depth.'],
    ['Best way to stop a model leaking a secret?', 'Never put the secret in the model\'s context.'],
  ],
  'b-indirect-prompt-injection': [
    ['Indirect vs direct prompt injection?', 'Indirect arrives via processed content (web pages, emails, documents, tool output), not the user\'s own message.'],
    ['Why is indirect injection dangerous for agents?', 'The attacker\'s instructions run with the victim\'s permissions, without the victim typing anything malicious.'],
    ['Two controls before an agent sends data out?', 'User confirmation showing exact content and recipient, plus a destination allow-list enforced in code.'],
    ['Where can hidden instructions hide?', 'White-on-white text, HTML comments, metadata, alt text, code comments and tool results.'],
  ],
  'b-sensitive-info-disclosure': [
    ['Where should RAG access control be enforced?', 'At retrieval time, filtering documents by the authenticated user\'s permissions and tenant.'],
    ['OWASP LLM Top 10 ID for sensitive information disclosure?', 'LLM02.'],
    ['A sensitive-data risk outside the model?', 'Verbose logs and analytics that store full conversations with personal data.'],
    ['Strongest isolation for multi-tenant RAG?', 'Separate indexes or namespaces per tenant, plus server-side query filtering.'],
  ],
  'b-improper-output-handling': [
    ['Why is LLM output untrusted?', 'Attackers can influence it through injection, so it can carry payloads like any user input.'],
    ['innerHTML with model output risks…', 'Cross-site scripting (XSS).'],
    ['OWASP LLM Top 10 ID for improper output handling?', 'LLM05.'],
    ['How to handle model-generated structured data?', 'Validate it against a strict schema before any downstream use.'],
  ],
  'c-excessive-agency': [
    ['Three forms of excessive agency?', 'Excessive functionality, excessive permissions, excessive autonomy.'],
    ['OWASP LLM Top 10 ID for excessive agency?', 'LLM06.'],
    ['Safer than a generic SQL tool?', 'A narrow tool like get_order_status(order_id), scoped to the signed-in customer.'],
    ['Limits to put on agent loops?', 'Rate limits, budgets and maximum step counts, with every tool call logged.'],
  ],
  'c-mcp-security': [
    ['What is MCP tool poisoning?', 'Hidden malicious instructions in an MCP tool\'s description or metadata that the model reads and follows.'],
    ['What is token passthrough, and is it allowed?', 'Forwarding client tokens to downstream APIs. The MCP security guidance says servers must not do it.'],
    ['What should an MCP server validate on incoming tokens?', 'That the token was issued for this server (audience) by the expected authorization server.'],
    ['Two guardrails for third-party MCP servers?', 'An allow-list of reviewed, version-pinned servers, and re-approval when tools or scopes change.'],
  ],
  'c-human-approval': [
    ['What is approval fatigue?', 'People approve without reading because they are asked too often.'],
    ['What should an approval screen show?', 'The exact action and parameters, rendered from structured data, with anomalies highlighted.'],
    ['Safe default for an unanswered approval?', 'Reject, or time out to reject.'],
    ['Which actions need human approval?', 'Risk-based: irreversible, external, financial or privileged actions, not every step.'],
  ],
  'd-test-planning': [
    ['What must exist before testing an AI app?', 'Written authorization and an agreed scope (rules of engagement).'],
    ['Parts of a good test case?', 'Objective, preconditions, steps, expected secure behavior and a measurable pass/fail criterion.'],
    ['Why repeat LLM attack prompts?', 'Outputs are non-deterministic. Report a success rate such as 3 of 20.'],
    ['Evidence to record with each result?', 'Model version, configuration, timestamps, inputs, outputs and relevant logs.'],
  ],
  'd-severity-reporting': [
    ['Severity combines which two factors?', 'Likelihood and impact.'],
    ['A known limitation of CVSS for AI findings?', 'It doesn\'t capture probabilistic success rates, so justify ratings in writing.'],
    ['How do you treat a low success rate with critical impact?', 'As serious: attackers can retry automatically. Report the rate.'],
    ['What happens to a fixed finding?', 'It becomes an automated regression test.'],
  ],
  'f-llm-context': [
    ['What is a token?', 'A word piece. LLMs read and generate text as sequences of tokens.'],
    ['Are system, user and tool messages isolated inside the model?', 'No. They are one token sequence. Roles are learned conventions, not enforced boundaries.'],
    ['Why does the same prompt give different answers?', 'Generation samples from probabilities, so output is non-deterministic.'],
    ['Where must security rules live?', 'In deterministic application code outside the model.'],
  ],
  'f-rag-basics': [
    ['The six RAG stages?', 'Ingest, chunk, embed, store, retrieve, generate.'],
    ['What is an embedding?', 'A numeric vector representing a chunk\'s meaning, used for similarity search.'],
    ['Does vector similarity respect permissions?', 'No. Access control must be applied at retrieval using chunk metadata.'],
    ['Metadata to store with every chunk?', 'Owner, tenant and access-control (ACL) information, plus the source.'],
  ],
};

export const flashcards: Flashcard[] = Object.entries(deck).flatMap(([lessonId, cards]) =>
  cards.map(([front, back], i) => ({ id: `${lessonId}-fc${i + 1}`, lessonId, front, back })),
);
