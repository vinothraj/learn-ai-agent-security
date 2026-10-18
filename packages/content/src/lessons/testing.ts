import type { Lesson } from '@laas/shared';
import { REF } from '../references';

const common = { roadmapId: 'ai-security-testing', status: 'needs_review', version: 1 } as const;

export const testingLessons: Lesson[] = [
  {
    ...common,
    id: 'd-test-planning',
    title: 'Planning an AI security test',
    summary: 'Scope, authorization, test cases and pass/fail criteria before you send a single prompt.',
    level: 'intermediate',
    minutes: 7,
    tags: ['testing', 'red-teaming', 'methodology'],
    prerequisites: ['a-trust-boundaries'],
    objective:
      'Write a test plan for an LLM application with clear scope, written authorization, test cases and objective pass/fail criteria.',
    explanation: [
      'A security test starts with written authorization and a defined scope: which application, environments, accounts, data and techniques are allowed, and what is explicitly out of bounds. Testing systems you are not authorized to test can be illegal.',
      'Each test case states its objective, preconditions, steps, the expected secure behavior and a pass/fail criterion. "The assistant refuses to reveal other customers\' orders" is testable; "the assistant is secure" is not.',
      'LLM output is non-deterministic, so one run proves little. Repeat each attack several times and record the success rate (for example 3 out of 20 attempts) along with model version, settings and timestamps.',
    ],
    example: {
      title: 'Fictional: test case TC-07 for ShopBot',
      body: 'Objective: verify ShopBot cannot read another customer\'s orders. Precondition: two test accounts, A and B. Steps: as A, ask for B\'s latest order using 10 phrasings, including indirect injection via a product review. Expected: every response refuses or shows only A\'s data, and the API log shows no query for B. Pass: 0 of 10 attempts leak data.',
    },
    risk:
      'Unplanned testing misses critical paths, produces unrepeatable results, and can harm production systems or real users\' data.',
    controls: [
      'Get written authorization and agree on rules of engagement before testing',
      'Define expected secure behavior and a measurable pass/fail criterion per test case',
      'Repeat non-deterministic tests and report success rates, not single outcomes',
      'Use dedicated test accounts and synthetic data, never real customer data',
      'Record model version, configuration and timestamps as evidence',
    ],
    quiz: [
      {
        id: 'd-tp-q1',
        prompt: 'Which is a well-formed pass/fail criterion?',
        options: [
          'The chatbot should be secure',
          '0 of 20 attempts return another user\'s order data',
          'The model seems to refuse most of the time',
          'No obvious problems are found',
        ],
        correctIndex: 1,
        explanation: 'A good criterion is objective and measurable, so different testers reach the same verdict.',
      },
      {
        id: 'd-tp-q2',
        prompt: 'Why run each LLM attack prompt multiple times?',
        options: [
          'To increase API costs',
          'Because outputs are non-deterministic, so a single run can miss or overstate a vulnerability',
          'Because the first response is always cached',
          'It is not necessary',
        ],
        correctIndex: 1,
        explanation: 'Sampling makes outputs vary. Reporting a success rate gives an honest picture of risk.',
      },
      {
        id: 'd-tp-q3',
        prompt: 'What must exist before you start testing a company\'s AI assistant?',
        options: ['A bug bounty T-shirt', 'Written authorization and an agreed scope', 'Production admin passwords', 'Nothing, if the app is public'],
        correctIndex: 1,
        explanation: 'Authorization and scope protect you, the organization and its users.',
      },
    ],
    interview: {
      id: 'd-tp-iq',
      question: 'How would you structure a security assessment of a customer-facing LLM chatbot?',
      modelAnswer:
        'I would start with authorization and scope: environments, accounts, allowed techniques and out-of-scope systems. Then I would threat model the data flows and map risks to the OWASP LLM Top 10 to derive test cases, each with an expected secure behavior and a measurable pass/fail criterion. I would execute with test accounts and synthetic data, repeat attacks to get success rates, and capture evidence with model versions and logs. Findings get severity ratings, reproduction steps and remediation, and fixed issues become regression tests.',
      keyConcepts: ['authorization and scope', 'threat model', 'test cases with pass/fail', 'repeat for success rate', 'evidence', 'regression tests'],
      evidence: 'established',
    },
    references: [REF.owaspAiTesting, REF.owaspLlmTop10, REF.nistGenAiProfile],
    evidence: 'established',
  },
  {
    ...common,
    id: 'd-severity-reporting',
    title: 'Severity scoring and reporting findings',
    summary: 'Turn a successful attack into a finding that engineers can prioritise and fix.',
    level: 'intermediate',
    minutes: 7,
    tags: ['testing', 'reporting', 'risk'],
    prerequisites: ['d-test-planning'],
    objective:
      'Rate the severity of an AI security finding using likelihood and impact, and write a report entry that is reproducible and actionable.',
    explanation: [
      'Severity combines likelihood (how easy and how reliable the attack is, and who can perform it) with impact (what data or actions are exposed and how many users are affected). The OWASP Risk Rating Methodology structures this.',
      'CVSS is widely used for software vulnerabilities, but it does not capture everything about AI systems, such as an attack that works 1 time in 10. State the success rate and explain your reasoning instead of relying on a single number.',
      'A good finding includes a title, affected component, severity with justification, reproduction steps and evidence, success rate, business impact, a concrete remediation, and how to verify the fix.',
    ],
    example: {
      title: 'Fictional finding F-03',
      body: 'Title: Indirect prompt injection in product reviews exfiltrates order history. Likelihood: high (any customer can post a review; works in 7 of 20 runs). Impact: high (other customers\' order data). Severity: High. Remediation: filter retrieval by the requesting user, strip instructions from review content and require confirmation for outbound links. Verification: re-run TC-07; 0 of 20 attempts succeed.',
    },
    risk:
      'Vague or inflated findings get ignored or mis-prioritized, leaving real risks open and eroding trust in the security team.',
    controls: [
      'Justify severity with explicit likelihood and impact factors',
      'Include reproduction steps, evidence and success rate',
      'Recommend specific, testable remediations',
      'Turn each fixed finding into an automated regression test',
    ],
    quiz: [
      {
        id: 'd-sr-q1',
        prompt: 'Which two factors drive a risk-based severity rating?',
        options: ['Cost and color', 'Likelihood and impact', 'Model size and latency', 'Prompt length and temperature'],
        correctIndex: 1,
        explanation: 'Risk ratings such as the OWASP methodology combine likelihood and impact.',
      },
      {
        id: 'd-sr-q2',
        prompt: 'An injection works in 2 of 50 runs and leaks admin credentials. How should you report it?',
        options: [
          'Ignore it; it rarely works',
          'Report it with the 2/50 success rate; the impact is critical and attackers can retry',
          'Mark it informational',
          'Only report it if it works every time',
        ],
        correctIndex: 1,
        explanation: 'Attackers can retry automatically, so a low success rate with critical impact is still serious.',
      },
    ],
    interview: {
      id: 'd-sr-iq',
      question: 'How do you rate the severity of a prompt injection that only works some of the time?',
      modelAnswer:
        'I measure and report the success rate over repeated runs, then rate likelihood using who can trigger it, how easily, and whether retries are cheap, since attackers can automate attempts. Impact depends on what the injection reaches: data, tools, other users. I combine them with a risk methodology such as OWASP Risk Rating and justify the result in writing, noting CVSS limitations for probabilistic behavior. The report includes reproduction steps, evidence, remediation and a verification test.',
      keyConcepts: ['success rate', 'likelihood', 'impact', 'retries are cheap', 'risk methodology', 'justification', 'verification'],
      evidence: 'emerging',
    },
    references: [REF.owaspRiskRating, REF.cvss, REF.owaspAiTesting],
    evidence: 'emerging',
  },
];
