import type { Lesson } from '@laas/shared';
import { REF } from '../references';

const common = { roadmapId: 'interview-career', status: 'needs_review', version: 1 } as const;

export const careerLessons: Lesson[] = [
  {
    ...common,
    id: 'e-ai-security-roles',
    title: 'AI security roles and skills',
    summary: 'What AI security engineers, red teamers and AppSec specialists actually do.',
    level: 'beginner',
    minutes: 6,
    tags: ['career', 'roles', 'skills'],
    prerequisites: [],
    objective: 'Match AI security roles to the skills interviewers test, and plan what to practise.',
    explanation: [
      'Most AI security roles combine classic security with AI-specific knowledge. An AI security engineer designs controls and reviews features; a GenAI security engineer focuses on LLM application risks; an AI red teamer runs adversarial tests; an AppSec engineer for LLM apps reviews code and architecture.',
      'Interviewers usually test four things: fundamentals (threat modeling, authentication, authorization, data protection), AI risk knowledge (the OWASP LLM Top 10, agent and RAG risks), practical judgement (which control first, and why) and communication (explaining a finding to engineers and managers).',
      'Evidence beats claims. Lab reports, small projects that secure a demo LLM app, and clear write-ups of what you tested and fixed show these skills better than a list of buzzwords.',
    ],
    example: {
      title: 'Fictional: preparing for an AppSec (LLM) interview',
      body: 'A candidate maps the job description to four areas, finds a gap in agent security, completes the excessive agency and MCP labs, and writes a one-page report with severity and fixes. In the interview she walks through that report as her example.',
    },
    risk: 'Candidates who only memorise attack names struggle when asked which control they would implement first and why.',
    controls: [
      'Map each job description to fundamentals, AI risks, judgement and communication',
      'Close gaps with hands-on labs and short write-ups',
      'Prepare examples that show a decision and its trade-offs',
      'Practise explaining one finding to an engineer and to a manager',
    ],
    quiz: [
      {
        id: 'e-roles-q1',
        prompt: 'Which skill do AI security interviews test besides attack knowledge?',
        options: ['Judgement about which control to apply first', 'Typing speed', 'GPU benchmarking', 'Graphic design'],
        correctIndex: 0,
        explanation: 'Prioritising controls shows practical experience.',
      },
      {
        id: 'e-roles-q2',
        prompt: 'What is the strongest evidence of skill?',
        options: ['A lab report showing what you tested and fixed', 'A long list of buzzwords', 'Owning many certificates only', 'A large social following'],
        correctIndex: 0,
        explanation: 'Concrete work products show applied skill.',
      },
      {
        id: 'e-roles-q3',
        prompt: 'An AI red teamer primarily…',
        options: ['Runs authorized adversarial tests and measures failures', 'Trains production models', 'Writes marketing copy', 'Manages cloud billing'],
        correctIndex: 0,
        explanation: 'Red teaming is structured adversarial testing.',
      },
    ],
    interview: {
      id: 'e-roles-iq',
      question: 'Why do you want to work in AI security, and what have you done to prepare?',
      modelAnswer:
        'AI features are reaching production faster than security practices, and I enjoy turning new risks into concrete controls. To prepare I studied the OWASP LLM Top 10 and agent risks, completed hands-on labs on prompt injection, excessive agency and RAG access control, and wrote short reports with severity and fixes for each. I can explain one finding in depth, including the trade-off I made between a guardrail and least privilege.',
      keyConcepts: ['motivation', 'OWASP LLM Top 10', 'hands-on labs', 'reports with severity and fixes', 'explain a finding', 'trade-off'],
      evidence: 'opinion',
    },
    references: [REF.owaspLlmTop10, REF.owaspGenAi],
    evidence: 'opinion',
  },
  {
    ...common,
    id: 'e-explaining-findings',
    title: 'Explaining findings clearly',
    summary: 'Use a simple structure to explain a security issue to engineers and managers.',
    level: 'beginner',
    minutes: 6,
    tags: ['career', 'communication', 'reporting'],
    prerequisites: ['d-severity-reporting'],
    objective: 'Explain an AI security finding with impact, evidence and a prioritised fix.',
    explanation: [
      'Interviewers and stakeholders want the same thing: what is wrong, why it matters, how sure you are and what to do. A reliable structure is: context, issue, impact, evidence, recommendation, and next step.',
      'Adapt the depth to the audience. Engineers need reproduction steps, root cause and the exact control. Managers need business impact, likelihood, effort to fix and residual risk in plain language.',
      'For behavioural questions, the STAR format (Situation, Task, Action, Result) keeps answers focused. End with what you learned or would do differently.',
    ],
    example: {
      title: 'Fictional: one finding, two audiences',
      body: 'To engineers: "The summarise tool passes raw email HTML to the model; a hidden instruction triggered forward_email in 7 of 20 runs; add approval for outbound email and strip hidden content." To the manager: "Attackers could make the assistant forward customer invoices; fixing it takes two days and removes the main risk."',
    },
    risk: 'Correct findings explained poorly get ignored, misprioritised or fixed in the wrong place.',
    controls: [
      'Structure every explanation as context, issue, impact, evidence and recommendation',
      'Give engineers reproduction steps and root cause',
      'Give managers impact, likelihood, effort and residual risk',
      'Use STAR for behavioural interview answers',
    ],
    quiz: [
      {
        id: 'e-exp-q1',
        prompt: 'What does a manager most need from a finding?',
        options: ['Business impact, likelihood, effort and residual risk', 'Raw HTTP traces', 'The model\'s token count', 'A list of payloads'],
        correctIndex: 0,
        explanation: 'Managers decide priority and resources.',
      },
      {
        id: 'e-exp-q2',
        prompt: 'STAR stands for…',
        options: ['Situation, Task, Action, Result', 'Scope, Test, Attack, Report', 'Security, Trust, Access, Risk', 'Start, Try, Assess, Repeat'],
        correctIndex: 0,
        explanation: 'STAR keeps behavioural answers focused.',
      },
      {
        id: 'e-exp-q3',
        prompt: 'Which detail belongs in the engineer version?',
        options: ['Reproduction steps and root cause', 'Company share price', 'Marketing tagline', 'Nothing technical'],
        correctIndex: 0,
        explanation: 'Engineers need enough to reproduce and fix.',
      },
    ],
    interview: {
      id: 'e-exp-iq',
      question: 'Tell me about a security issue you found and how you got it fixed.',
      modelAnswer:
        'Using STAR: the situation was an assistant that summarised email; my task was to test it before launch. My action was to write an indirect injection test, which triggered the forward email tool in 7 of 20 runs. I explained the impact and evidence to engineers with reproduction steps and root cause, and to the manager with business impact and effort. The result was human approval for outbound email and hidden-content stripping; the retest passed 0 of 20.',
      keyConcepts: ['situation and task', 'action', 'result', 'impact and evidence', 'reproduction steps and root cause', 'business impact', 'retest'],
      evidence: 'opinion',
    },
    references: [REF.owaspRiskRating],
    evidence: 'opinion',
  },
];
