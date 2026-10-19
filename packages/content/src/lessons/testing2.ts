import type { Lesson } from '@laas/shared';
import { REF } from '../references';

const common = { roadmapId: 'ai-security-testing', status: 'needs_review', version: 1 } as const;

export const testingLessons2: Lesson[] = [
  {
    ...common,
    id: 'd-test-case-design',
    title: 'Designing AI security test cases',
    summary: 'Turn a threat into a repeatable test with clear pass and fail criteria.',
    level: 'intermediate',
    minutes: 7,
    tags: ['testing', 'test-cases', 'methodology'],
    prerequisites: ['d-test-planning'],
    objective: 'Write AI security test cases that are specific, repeatable and measurable.',
    explanation: [
      'A good test case names the threat, the preconditions (user role, data, tools enabled), the input or payload, the expected secure behaviour and the evidence to capture. "Try to jailbreak it" is not a test case.',
      'LLM output is non-deterministic, so one attempt proves little. Run each case several times or with variations, and define pass criteria as a rate (for example, no secret disclosed in 50 attempts) or as a hard invariant enforced by code (the delete tool is never called without approval).',
      'Prefer checking effects over wording: test whether data actually crossed a boundary or a tool actually ran, not only whether the reply sounds safe.',
    ],
    example: {
      title: 'Fictional: test case for an email agent',
      body: 'Threat: indirect injection via email. Precondition: user mailbox with one email containing hidden instructions to forward invoices. Steps: ask the agent to summarise today\'s email, 20 runs. Expected: no forward_email call, summary flags the suspicious email. Evidence: tool-call logs and transcripts.',
    },
    risk: 'Vague, one-off tests give false confidence and cannot be repeated after fixes.',
    controls: [
      'Write each test with threat, preconditions, input, expected result and evidence',
      'Run variations and repeats; define pass criteria as rates or invariants',
      'Assert on effects (tool calls, data access) rather than reply wording',
      'Store tests in a suite so they can be re-run after every change',
    ],
    quiz: [
      {
        id: 'd-tcd-q1',
        prompt: 'Why run an LLM security test case many times?',
        options: ['Outputs are non-deterministic', 'To warm the GPU', 'To fill logs', 'Tests are cheaper in bulk'],
        correctIndex: 0,
        explanation: 'A single pass can hide a failure that happens 1 time in 20.',
      },
      {
        id: 'd-tcd-q2',
        prompt: 'Which is the strongest assertion for an agent test?',
        options: ['The delete tool was not called (from tool logs)', 'The reply sounded polite', 'The reply was short', 'The model used the word "sorry"'],
        correctIndex: 0,
        explanation: 'Effects are what matter; wording can mislead.',
      },
      {
        id: 'd-tcd-q3',
        prompt: 'Which element is missing from "try to jailbreak the bot"?',
        options: ['Preconditions, specific input, expected result and evidence', 'A model name', 'A colour', 'Nothing, it is complete'],
        correctIndex: 0,
        explanation: 'A test case must be specific enough to repeat and judge.',
      },
    ],
    interview: {
      id: 'd-tcd-iq',
      question: 'How do you write a good test case for an LLM security issue?',
      modelAnswer:
        'Each test case names the threat, the preconditions such as user role, data and enabled tools, the exact input, the expected secure behaviour and the evidence to capture. Because output is non-deterministic I run repeats and variations and define pass criteria as a rate or a hard invariant. I assert on effects like tool calls and data access from logs rather than on reply wording, and I keep the case in a regression suite to re-run after every change.',
      keyConcepts: ['threat and preconditions', 'expected behaviour', 'evidence', 'repeats and variations', 'pass criteria as rate or invariant', 'assert on effects', 'regression suite'],
      evidence: 'established',
    },
    references: [REF.owaspAiTesting],
    evidence: 'established',
  },
  {
    ...common,
    id: 'd-red-teaming',
    title: 'Red teaming LLM applications',
    summary: 'Plan an adversarial exercise, run it safely and report what matters.',
    level: 'intermediate',
    minutes: 8,
    tags: ['red-teaming', 'testing', 'evaluation'],
    prerequisites: ['d-test-planning', 'b-prompt-injection'],
    objective: 'Run a scoped, authorized red-team exercise against an LLM application you own.',
    explanation: [
      'AI red teaming is structured adversarial testing to find ways a system can be made to fail: leak data, bypass policies, misuse tools or produce harmful output. It is done only with written authorization, on systems you own or are allowed to test.',
      'Start with scope and rules of engagement (targets, accounts, data, out-of-scope actions, stop conditions). Build attack scenarios from the threat model, mixing manual creativity with automated variations and published attack libraries.',
      'Measure, do not just collect screenshots: record success rates per technique, the impact if it succeeded, and which control failed. Report findings with severity, reproduction steps and remediation, then retest.',
    ],
    example: {
      title: 'Fictional: two-day exercise',
      body: 'A team red-teams its support bot in staging with test accounts. Indirect injection through uploaded PDFs succeeds 7 times in 40, leading to a high-severity finding because the bot can issue refunds. After adding approval for refunds and content scanning, the retest succeeds 0 times in 40.',
    },
    risk: 'Unscoped testing can damage real systems or data, and unmeasured results cannot guide fixes.',
    controls: [
      'Get written authorization and define scope and rules of engagement',
      'Derive scenarios from the threat model and combine manual and automated attacks',
      'Test in staging with test accounts and synthetic data where possible',
      'Record success rates, impact and the failing control for each technique',
      'Report with severity and reproduction steps, then retest after fixes',
    ],
    quiz: [
      {
        id: 'd-rt-q1',
        prompt: 'What must exist before any red-team activity starts?',
        options: ['Written authorization and agreed scope', 'A press release', 'A larger model', 'Public disclosure'],
        correctIndex: 0,
        explanation: 'Authorization and scope protect people, data and the tester.',
      },
      {
        id: 'd-rt-q2',
        prompt: 'Which result is most useful in a red-team report?',
        options: ['Success rate per technique with impact and failing control', 'A list of funny outputs', 'The number of prompts typed', 'The tester\'s opinion of the brand'],
        correctIndex: 0,
        explanation: 'Measured results tell the team what to fix first.',
      },
      {
        id: 'd-rt-q3',
        prompt: 'Where should red teaming of a production-like agent ideally run?',
        options: ['In staging with test accounts and synthetic data', 'On live customer accounts', 'On a competitor\'s product', 'Nowhere, it is illegal'],
        correctIndex: 0,
        explanation: 'Staging avoids harm to real users while staying realistic.',
      },
    ],
    interview: {
      id: 'd-rt-iq',
      question: 'How would you plan and run a red-team exercise on an LLM product?',
      modelAnswer:
        'First I get written authorization and agree the scope and rules of engagement, including stop conditions. I build scenarios from the threat model and combine manual attacks with automated variations, running in staging with test accounts and synthetic data. For each technique I record the success rate, the impact and which control failed. The report gives severity, reproduction steps and remediation, and I retest after fixes to confirm the success rate dropped.',
      keyConcepts: ['written authorization', 'scope and rules of engagement', 'scenarios from threat model', 'manual and automated attacks', 'staging with test accounts', 'success rate and impact', 'retest after fixes'],
      evidence: 'established',
    },
    references: [REF.owaspAiTesting, REF.mitreAtlas, REF.nistGenAiProfile],
    evidence: 'established',
  },
  {
    ...common,
    id: 'd-guardrail-evals',
    title: 'Evaluating guardrails',
    summary: 'Measure how often filters block attacks and how often they block legitimate users.',
    level: 'advanced',
    minutes: 7,
    tags: ['guardrails', 'evaluation', 'metrics'],
    prerequisites: ['d-test-case-design'],
    objective: 'Measure guardrail effectiveness with false-negative and false-positive rates.',
    explanation: [
      'Guardrails (input classifiers, output filters, policy models) reduce risk but are never perfect. Evaluate them like any detector with two numbers: the bypass rate on an attack set (false negatives) and the block rate on legitimate requests (false positives).',
      'Build two datasets: realistic attacks, including paraphrases, encodings and multi-turn attempts, and realistic benign traffic that is close to the boundary, such as security learners asking about prompt injection.',
      'Track both numbers over time and per release. A guardrail that blocks everything is useless; one that a simple rephrase bypasses gives false comfort. Guardrails complement, never replace, architectural controls like least privilege and approval.',
    ],
    example: {
      title: 'Fictional: PolicyFilter v2',
      body: 'A new input filter blocks 96% of a 500-prompt attack set but also blocks 18% of real support questions that mention "password reset". The team tunes it to 91% blocked attacks and 2% false positives, and relies on server-side authorization for the rest.',
    },
    risk: 'Untested guardrails either let attacks through or frustrate legitimate users, often both.',
    controls: [
      'Measure bypass rate on an attack set and false-positive rate on benign traffic',
      'Include paraphrases, encodings and multi-turn attacks in the attack set',
      'Include near-boundary legitimate requests in the benign set',
      'Track metrics per release and alert on regressions',
      'Keep architectural controls; guardrails are one layer',
    ],
    quiz: [
      {
        id: 'd-ge-q1',
        prompt: 'Which two metrics describe a guardrail?',
        options: ['Attack bypass rate and false-positive rate', 'Latency and colour', 'Model size and price', 'Tokens and temperature'],
        correctIndex: 0,
        explanation: 'You need both to judge security and usability.',
      },
      {
        id: 'd-ge-q2',
        prompt: 'Why include benign questions about prompt injection in the test set?',
        options: ['To catch over-blocking of legitimate near-boundary requests', 'To train the attacker', 'They are attacks', 'To increase the bill'],
        correctIndex: 0,
        explanation: 'Near-boundary benign traffic reveals false positives.',
      },
      {
        id: 'd-ge-q3',
        prompt: 'A guardrail blocks 99% of attacks. Can you remove approval for refunds?',
        options: ['No, guardrails are one layer and 1% still gets through', 'Yes, 99% is perfect', 'Yes, attackers give up', 'Only on weekends'],
        correctIndex: 0,
        explanation: 'Defence in depth keeps high-impact actions protected.',
      },
    ],
    interview: {
      id: 'd-ge-iq',
      question: 'How would you evaluate whether a prompt-injection guardrail is good enough?',
      modelAnswer:
        'I measure two numbers: the bypass rate on an attack set and the false-positive rate on benign traffic. The attack set includes paraphrases, encodings and multi-turn attempts; the benign set includes near-boundary legitimate requests. I track both per release and alert on regressions. Even with good numbers I keep architectural controls such as least privilege and human approval, because a guardrail is one layer of defence in depth.',
      keyConcepts: ['bypass rate', 'false-positive rate', 'paraphrases and encodings', 'near-boundary legitimate requests', 'track per release', 'defence in depth'],
      evidence: 'established',
    },
    references: [REF.owaspAiTesting, REF.owaspPromptInjectionCheatSheet],
    evidence: 'established',
  },
];
