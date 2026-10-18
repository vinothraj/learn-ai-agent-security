import type { Reference } from '@laas/shared';

/** Shared, authoritative references. Verified reachable by `npm run check:links`. */
export const REF = {
  owaspLlmTop10: {
    title: 'OWASP Top 10 for LLM Applications',
    publisher: 'OWASP GenAI Security Project',
    url: 'https://genai.owasp.org/llm-top-10/',
  },
  owaspGenAi: {
    title: 'OWASP GenAI Security Project (incl. Agentic AI guidance)',
    publisher: 'OWASP',
    url: 'https://genai.owasp.org/',
  },
  owaspPromptInjectionCheatSheet: {
    title: 'LLM Prompt Injection Prevention Cheat Sheet',
    publisher: 'OWASP Cheat Sheet Series',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html',
  },
  owaspXssCheatSheet: {
    title: 'Cross Site Scripting Prevention Cheat Sheet',
    publisher: 'OWASP Cheat Sheet Series',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
  },
  owaspAuthzCheatSheet: {
    title: 'Authorization Cheat Sheet',
    publisher: 'OWASP Cheat Sheet Series',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html',
  },
  owaspThreatModeling: {
    title: 'Threat Modeling Cheat Sheet',
    publisher: 'OWASP Cheat Sheet Series',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html',
  },
  mitreAtlas: {
    title: 'MITRE ATLAS (Adversarial Threat Landscape for AI Systems)',
    publisher: 'MITRE',
    url: 'https://atlas.mitre.org/',
  },
  nistAiRmf: {
    title: 'AI Risk Management Framework (AI RMF 1.0)',
    publisher: 'NIST',
    url: 'https://www.nist.gov/itl/ai-risk-management-framework',
  },
  ncscSecureAi: {
    title: 'Guidelines for secure AI system development',
    publisher: 'UK NCSC / CISA and partners',
    url: 'https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development',
  },
  mcpSecurity: {
    title: 'Model Context Protocol: Security Best Practices',
    publisher: 'Model Context Protocol',
    url: 'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  },
  mcpAuthorization: {
    title: 'Model Context Protocol: Authorization',
    publisher: 'Model Context Protocol',
    url: 'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  },
} satisfies Record<string, Reference>;
