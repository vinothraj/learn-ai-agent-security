import type { Lesson } from '@laas/shared';
import { REF } from '../references';

const common = { roadmapId: 'ai-security-foundations', status: 'needs_review', version: 1 } as const;

export const foundationsLessons2: Lesson[] = [
  {
    ...common,
    id: 'a-threat-modeling-llm',
    title: 'Threat modeling an LLM app',
    summary: 'Use STRIDE and a data-flow diagram to find AI risks before you write code.',
    level: 'intermediate',
    minutes: 8,
    tags: ['threat-modeling', 'stride', 'architecture'],
    prerequisites: ['a-trust-boundaries'],
    supportLessons: ['f-llm-context'],
    objective: 'Run a lightweight threat model for an LLM feature and turn each threat into a control and a test.',
    explanation: [
      'Threat modeling answers four questions: what are we building, what can go wrong, what will we do about it, and did we do a good job. Start with a data-flow diagram that shows users, the application, the model provider, data stores, tools and every trust boundary between them.',
      'STRIDE still works for AI systems. Prompt injection is tampering that often leads to elevation of privilege; leaked context is information disclosure; runaway agent loops and token floods are denial of service; missing tool-call logs make actions repudiable; and a model acting with a shared service account blurs spoofing and identity.',
      'Complement STRIDE with AI-specific catalogues such as the OWASP Top 10 for LLM Applications and MITRE ATLAS, so threats like data poisoning or system-prompt leakage are not missed. Each threat should end with an owner, a mitigation and a test case.',
    ],
    example: {
      title: 'Fictional: HR policy assistant',
      body: 'A team diagrams an HR chatbot: employee → web app → model API, plus a retrieval index over policy PDFs and a tool that opens tickets. Walking STRIDE finds that anyone who can upload a PDF can inject instructions (tampering) and that ticket creation is not logged per user (repudiation). Both become backlog items with tests.',
    },
    risk: 'Without a threat model, teams add guardrails at random and miss the paths attackers actually use, such as poisoned documents or over-privileged tools.',
    controls: [
      'Draw a data-flow diagram with every trust boundary before implementation',
      'Walk STRIDE per element and add AI-specific threats from OWASP LLM Top 10 and MITRE ATLAS',
      'Record each threat with an owner, a mitigation and a test case',
      'Revisit the model when tools, data sources or model providers change',
    ],
    quiz: [
      {
        id: 'a-tm-q1',
        prompt: 'Which STRIDE category best fits a prompt injection that makes an agent call an admin-only tool?',
        options: ['Elevation of privilege', 'Repudiation', 'Denial of service', 'Spoofing of the model provider'],
        correctIndex: 0,
        explanation: 'The attacker gains capabilities they should not have through the agent.',
      },
      {
        id: 'a-tm-q2',
        prompt: 'What is the first artifact of a threat model?',
        options: ['A penetration test report', 'A data-flow diagram with trust boundaries', 'A list of model hyperparameters', 'A bug bounty policy'],
        correctIndex: 1,
        explanation: 'You cannot reason about threats until you know how data and control flow through the system.',
      },
      {
        id: 'a-tm-q3',
        prompt: 'Why add the OWASP LLM Top 10 or MITRE ATLAS to STRIDE?',
        options: ['They replace STRIDE entirely', 'They catch AI-specific threats such as data poisoning', 'They are required by law', 'They make the model faster'],
        correctIndex: 1,
        explanation: 'AI catalogues name threats a generic framework may not prompt you to consider.',
      },
    ],
    interview: {
      id: 'a-tm-iq',
      question: 'Walk me through how you would threat model a new LLM feature.',
      modelAnswer:
        'I start with a data-flow diagram that marks every trust boundary: users, the app, the model provider, data stores and tools. Then I walk STRIDE per element and add AI threats from the OWASP LLM Top 10 and MITRE ATLAS, such as prompt injection, data poisoning and leakage. Each threat gets an owner, a mitigation and a test case, and I prioritise by impact and likelihood. I revisit the model whenever tools, data sources or the provider change.',
      keyConcepts: ['data-flow diagram', 'trust boundary', 'STRIDE', 'OWASP LLM Top 10', 'owner, mitigation and test', 'prioritise by impact and likelihood', 'revisit when changes'],
      evidence: 'established',
    },
    references: [REF.owaspThreatModeling, REF.owaspLlmTop10, REF.mitreAtlas],
    evidence: 'established',
  },
  {
    ...common,
    id: 'a-secure-ai-lifecycle',
    title: 'Secure AI development lifecycle',
    summary: 'Security activities for design, development, deployment and operation of AI systems.',
    level: 'beginner',
    minutes: 7,
    tags: ['sdlc', 'governance', 'supply-chain'],
    prerequisites: ['a-trust-boundaries'],
    objective: 'Place the right security activity in each stage of building and running an AI feature.',
    explanation: [
      'Joint guidance from the UK NCSC, CISA and partners organises secure AI work into four stages: secure design, secure development, secure deployment and secure operation and maintenance.',
      'Design covers threat modeling and choosing what the model may do. Development covers supply chain (where models, datasets and libraries come from), documentation and technical debt. Deployment covers infrastructure, access to model weights and APIs, and incident plans. Operation covers monitoring inputs and outputs, updating safely and sharing lessons learned.',
      'The key idea is that AI security is not a one-time review: models, prompts, data and tools keep changing, so controls and tests must run continuously.',
    ],
    example: {
      title: 'Fictional: ClaimsBot release',
      body: 'Before launch, the ClaimsBot team verifies the hash of the downloaded open-weights model, pins library versions, restricts who can change the system prompt, and adds an alert when refusal rates suddenly drop. After launch, a regression suite of injection prompts runs on every prompt change.',
    },
    risk: 'Security added only at launch misses poisoned dependencies, unreviewed prompt changes and drift that appears in production.',
    controls: [
      'Threat model during design and record what the AI may and may not do',
      'Track the provenance of models, datasets and libraries and verify their integrity',
      'Protect prompts, model weights and API keys with change control and access control',
      'Monitor inputs, outputs and tool calls in production with alerting',
      'Re-run security tests on every model, prompt or tool change',
    ],
    quiz: [
      {
        id: 'a-sdlc-q1',
        prompt: 'Verifying the checksum of a downloaded model belongs to which concern?',
        options: ['Supply chain security', 'Prompt engineering', 'UI design', 'Load balancing'],
        correctIndex: 0,
        explanation: 'Models are dependencies; their origin and integrity must be checked like any other artifact.',
      },
      {
        id: 'a-sdlc-q2',
        prompt: 'Why should security tests re-run after a system prompt change?',
        options: ['Prompts are code-like configuration that can weaken controls', 'It makes the model cheaper', 'Regulators require daily tests', 'Prompts cannot change behaviour'],
        correctIndex: 0,
        explanation: 'A prompt edit can remove refusals or expose tools, so treat it like a code change.',
      },
      {
        id: 'a-sdlc-q3',
        prompt: 'Which activity belongs to secure operation?',
        options: ['Monitoring outputs and alerting on anomalies', 'Choosing the product name', 'Writing the first requirements', 'Buying GPUs'],
        correctIndex: 0,
        explanation: 'Operation is about watching real behaviour and responding to incidents.',
      },
    ],
    interview: {
      id: 'a-sdlc-iq',
      question: 'How would you embed security into the lifecycle of an AI product?',
      modelAnswer:
        'I follow the four stages from the NCSC and CISA guidance. In design I threat model and define what the AI may do. In development I track the provenance of models, datasets and libraries and verify their integrity. In deployment I protect prompts, weights and API keys with access control and change control, and prepare an incident plan. In operation I monitor inputs, outputs and tool calls with alerting, and re-run security regression tests on every model or prompt change.',
      keyConcepts: ['design threat model', 'provenance of models and datasets', 'access control and change control', 'incident plan', 'monitor outputs with alerting', 'regression tests on every change'],
      evidence: 'established',
    },
    references: [REF.ncscSecureAi, REF.nistAiRmf],
    evidence: 'established',
  },
  {
    ...common,
    id: 'a-ai-risk-governance',
    title: 'AI risk management basics',
    summary: 'Govern, map, measure and manage AI risk with the NIST AI RMF.',
    level: 'beginner',
    minutes: 6,
    tags: ['governance', 'risk', 'nist'],
    prerequisites: [],
    objective: 'Explain the four functions of the NIST AI RMF and keep a simple AI risk register.',
    explanation: [
      'The NIST AI Risk Management Framework is voluntary guidance built around four functions: Govern (policies, roles and accountability), Map (understand the context and where risks come from), Measure (assess and track risks with tests and metrics) and Manage (prioritise and act on risks, including incident response).',
      'Its Generative AI Profile (NIST AI 600-1) lists risks specific to generative AI, such as confabulation, data privacy, information security and harmful content, and suggests actions for each.',
      'In practice, a small team can start with an AI inventory (which features use which models and data), a risk register with owners and ratings, and a review gate before anything ships.',
    ],
    example: {
      title: 'Fictional: a 3-person startup',
      body: 'The team lists its two AI features, notes that one sends customer emails to a third-party model, rates the privacy risk as high, assigns an owner, and adds a review step requiring data-processing terms before any new AI vendor is used.',
    },
    risk: 'Without governance, AI features appear without owners, unknown data flows to vendors, and nobody decides which risks are acceptable.',
    controls: [
      'Keep an inventory of AI features, models, vendors and data used',
      'Maintain a risk register with owner, rating and treatment for each risk',
      'Add a review gate for new AI use cases and vendors',
      'Measure risks with tests and metrics, and revisit ratings regularly',
    ],
    quiz: [
      {
        id: 'a-rmf-q1',
        prompt: 'Which NIST AI RMF function sets policies, roles and accountability?',
        options: ['Govern', 'Map', 'Measure', 'Manage'],
        correctIndex: 0,
        explanation: 'Govern is the cross-cutting function that establishes accountability.',
      },
      {
        id: 'a-rmf-q2',
        prompt: 'What is NIST AI 600-1?',
        options: ['A Generative AI profile of the AI RMF', 'An encryption standard', 'A model benchmark', 'A law that bans chatbots'],
        correctIndex: 0,
        explanation: 'It adapts the AI RMF to risks specific to generative AI.',
      },
      {
        id: 'a-rmf-q3',
        prompt: 'A minimal first step for AI governance in a small team is…',
        options: ['An inventory of AI features, models and data flows', 'Training a custom model', 'Buying an AI firewall', 'Banning all AI tools'],
        correctIndex: 0,
        explanation: 'You cannot manage risks in systems you have not listed.',
      },
    ],
    interview: {
      id: 'a-rmf-iq',
      question: 'A company has no AI governance yet. What do you put in place first?',
      modelAnswer:
        'I would start with an inventory of AI features, models, vendors and the data each one uses. Then a risk register with an owner, rating and treatment for every risk, following the NIST AI RMF functions Govern, Map, Measure and Manage. I would add a review gate for new AI use cases and vendors, and measure the main risks with tests and metrics so ratings are revisited regularly.',
      keyConcepts: ['inventory of AI features and data', 'risk register with owner', 'NIST AI RMF', 'review gate for new use cases', 'measure with tests and metrics'],
      evidence: 'established',
    },
    references: [REF.nistAiRmf, REF.nistGenAiProfile],
    evidence: 'established',
  },
];
