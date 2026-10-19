import type { Lesson } from '@laas/shared';
import { REF } from '../references';

const common = { roadmapId: 'ai-fundamentals', status: 'needs_review', version: 1 } as const;

export const fundamentalsLessons2: Lesson[] = [
  {
    ...common,
    id: 'f-tool-calling',
    title: 'How agents call tools',
    summary: 'The loop behind AI agents: model proposes, application executes.',
    level: 'beginner',
    minutes: 6,
    tags: ['agents', 'tool-calling', 'architecture'],
    prerequisites: ['f-llm-context'],
    objective: 'Explain the agent loop and where security checks belong in it.',
    explanation: [
      'A model cannot call an API by itself. In tool calling, the application describes available tools (name, description, parameters) to the model. The model replies with a structured request such as get_weather(city="Paris"). The application decides whether to run it, executes it and sends the result back.',
      'An agent repeats this loop: think, call a tool, read the result, decide the next step, until the task is done or a limit is reached.',
      'Security lives in the application, not the model: validate parameters, check the user\'s authorization, ask for approval on risky calls, and treat tool results as untrusted text before they go back into the model\'s context.',
    ],
    example: {
      title: 'Fictional: WeatherBot',
      body: 'The model asks for get_weather(city="Paris; DROP TABLE"). The application validates the city against a pattern and rejects it before any query runs. The model never touches the database directly.',
    },
    risk: 'Teams that assume the model "calls" tools forget to put validation and authorization in the code that really executes them.',
    controls: [
      'Validate tool parameters with strict schemas',
      'Check authorization in the executing code for the current user',
      'Require approval for high-impact tool calls',
      'Treat tool results as untrusted before adding them to context',
    ],
    quiz: [
      {
        id: 'f-tc-q1',
        prompt: 'Who actually executes a tool call?',
        options: ['The application code', 'The model itself', 'The user\'s keyboard', 'The tokenizer'],
        correctIndex: 0,
        explanation: 'The model only proposes; the application runs the call.',
      },
      {
        id: 'f-tc-q2',
        prompt: 'Where should parameter validation happen?',
        options: ['In the application before executing the tool', 'In the system prompt', 'In the model weights', 'After the tool has run'],
        correctIndex: 0,
        explanation: 'Validate before execution, in deterministic code.',
      },
      {
        id: 'f-tc-q3',
        prompt: 'Tool results returned to the model should be treated as…',
        options: ['Untrusted text that may contain injected instructions', 'Trusted system instructions', 'Encrypted secrets', 'User passwords'],
        correctIndex: 0,
        explanation: 'Tool output is a common indirect injection path.',
      },
    ],
    interview: {
      id: 'f-tc-iq',
      question: 'Explain how tool calling works and where you would put security controls.',
      modelAnswer:
        'The application describes tools to the model, the model proposes a structured call, and the application decides whether to execute it and returns the result; an agent repeats this loop until done or until a limit. Controls belong in the application: validate parameters against strict schemas, check authorization for the current user, require approval for high-impact calls, and treat tool results as untrusted before they re-enter the context.',
      keyConcepts: ['model proposes', 'application executes', 'agent loop', 'validate parameters', 'check authorization', 'approval for high-impact', 'tool results untrusted'],
      evidence: 'established',
    },
    references: [REF.owaspGenAi, REF.mcpSecurity],
    evidence: 'established',
  },
  {
    ...common,
    id: 'f-ml-lifecycle',
    title: 'Training, fine-tuning and inference',
    summary: 'Where models come from and what can be attacked at each stage.',
    level: 'beginner',
    minutes: 6,
    tags: ['ml-basics', 'training', 'inference'],
    prerequisites: [],
    objective: 'Distinguish pre-training, fine-tuning and inference, and the main security risk of each.',
    explanation: [
      'Pre-training teaches a base model general language patterns from huge datasets. Fine-tuning adapts it with smaller, task-specific data. Inference is using the trained model to answer requests in production.',
      'Each stage has its own attack surface: poisoned data in pre-training or fine-tuning, stolen or tampered model weights in storage, and prompt injection, data leakage and abuse at inference time.',
      'Most product teams never pre-train. They pick a provider or open-weights model, maybe fine-tune it or add retrieval (RAG), and spend most security effort on inference: inputs, outputs, tools and access control.',
    ],
    example: {
      title: 'Fictional: a typical product team',
      body: 'A team uses a hosted model for inference, fine-tunes a small open model on approved support tickets, and stores the fine-tuned weights in a private bucket. Their risks: poisoned tickets in fine-tuning, leaked weights from the bucket, and prompt injection in production.',
    },
    risk: 'Confusing the stages leads teams to apply the wrong controls, for example worrying about training data they never use while ignoring inference-time injection.',
    controls: [
      'Know which stages your product actually uses',
      'Protect fine-tuning data with provenance and review',
      'Store model weights with access control and integrity checks',
      'Focus inference controls on inputs, outputs, tools and authorization',
    ],
    quiz: [
      {
        id: 'f-ml-q1',
        prompt: 'Using a trained model to answer requests is called…',
        options: ['Inference', 'Pre-training', 'Tokenization', 'Backpropagation'],
        correctIndex: 0,
        explanation: 'Inference is the production use of a model.',
      },
      {
        id: 'f-ml-q2',
        prompt: 'Which risk mainly belongs to fine-tuning?',
        options: ['Poisoned training examples', 'Slow page loads', 'Expired TLS certificates', 'Wrong font'],
        correctIndex: 0,
        explanation: 'Fine-tuning learns from data that can be manipulated.',
      },
      {
        id: 'f-ml-q3',
        prompt: 'Where do most product teams spend their AI security effort?',
        options: ['Inference: inputs, outputs, tools and access', 'Pre-training from scratch', 'Designing GPUs', 'Writing tokenizers'],
        correctIndex: 0,
        explanation: 'Most teams build on existing models and secure their usage.',
      },
    ],
    interview: {
      id: 'f-ml-iq',
      question: 'What is the difference between training, fine-tuning and inference from a security point of view?',
      modelAnswer:
        'Pre-training builds a base model from huge datasets, fine-tuning adapts it with smaller task data, and inference serves requests in production. Pre-training and fine-tuning are exposed to data poisoning, so data needs provenance and review. Model weights must be stored with access control and integrity checks. Inference is where prompt injection, data leakage and abuse happen, so controls there focus on inputs, outputs, tools and authorization.',
      keyConcepts: ['pre-training', 'fine-tuning', 'inference', 'data poisoning', 'provenance and review', 'weights access control', 'prompt injection at inference'],
      evidence: 'established',
    },
    references: [REF.nistAiRmf, REF.mitreAtlas],
    evidence: 'established',
  },
  {
    ...common,
    id: 'f-embeddings',
    title: 'Embeddings and vector search',
    summary: 'How text becomes numbers, and why that matters for privacy and access control.',
    level: 'beginner',
    minutes: 6,
    tags: ['embeddings', 'rag', 'vector-db'],
    prerequisites: ['f-rag-basics'],
    objective: 'Explain what embeddings are and the security properties people often assume wrongly.',
    explanation: [
      'An embedding model turns a piece of text into a vector, a list of numbers that captures its meaning. Texts with similar meaning have vectors that are close together, which lets a vector database find relevant chunks by similarity rather than exact words.',
      'Two common misconceptions: embeddings are not encryption (research shows text can often be partially reconstructed from them), and similarity search has no idea who is allowed to see what.',
      'So vectors of sensitive documents deserve the same protection as the documents, and access control must be applied with metadata filters when searching.',
    ],
    example: {
      title: 'Fictional: VectorLake',
      body: 'A team exports embeddings of medical notes to a vendor, assuming they are anonymous. The vendor recovers fragments of names and diagnoses. Treating vectors as sensitive data would have kept them under the same controls as the notes.',
    },
    risk: 'Treating embeddings as anonymous leads to data exposure and cross-user leakage in search results.',
    controls: [
      'Protect embeddings of sensitive data like the source data',
      'Store access-control metadata with every vector',
      'Filter searches by the caller\'s permissions',
      'Delete vectors when the source is deleted',
    ],
    quiz: [
      {
        id: 'f-emb-q1',
        prompt: 'Are embeddings a form of encryption?',
        options: ['No, text can often be partially reconstructed', 'Yes, they are irreversible', 'Only for images', 'Only when stored on disk'],
        correctIndex: 0,
        explanation: 'Treat vectors of sensitive text as sensitive.',
      },
      {
        id: 'f-emb-q2',
        prompt: 'Vector similarity search finds chunks that are…',
        options: ['Close in meaning to the query', 'Allowed for the current user', 'Newest first', 'Alphabetically sorted'],
        correctIndex: 0,
        explanation: 'Similarity is about meaning, not permissions.',
      },
      {
        id: 'f-emb-q3',
        prompt: 'What makes vector search respect permissions?',
        options: ['Metadata filters based on the caller\'s identity', 'A bigger embedding model', 'Higher similarity thresholds', 'Nothing can'],
        correctIndex: 0,
        explanation: 'Access control has to be added explicitly.',
      },
    ],
    interview: {
      id: 'f-emb-iq',
      question: 'Are embeddings of customer documents safe to share with a third party?',
      modelAnswer:
        'Not by default. Embeddings are not encryption: research shows text can often be partially reconstructed from vectors, so embeddings of sensitive data should be protected like the source data and covered by the same agreements. Inside our own system, every vector carries access-control metadata, searches are filtered by the caller\'s permissions, and vectors are deleted when the source is deleted.',
      keyConcepts: ['not encryption', 'partially reconstructed', 'protect like source data', 'access-control metadata', 'filtered by permissions', 'delete when source deleted'],
      evidence: 'emerging',
    },
    references: [REF.owaspLlmTop10],
    evidence: 'emerging',
  },
];
