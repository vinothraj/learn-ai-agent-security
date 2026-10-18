import { severityOf, SEVERITY_ORDER, type Lab, type LabEvaluation, type Severity } from './labs';

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SEV_COLOR: Record<Severity, string> = {
  critical: '#B91C1C',
  high: '#C2410C',
  medium: '#B45309',
  low: '#1D4ED8',
  note: '#475569',
};

export interface LabReportInput {
  lab: Lab;
  evaluation: LabEvaluation;
  enabled: string[];
  tester: string;
  date: Date;
}

/** Pentest-style report for a simulated lab. Every string is HTML-escaped. */
export function buildLabReportHtml({ lab, evaluation, enabled, tester, date }: LabReportInput): string {
  const labels = lab.outcomeLabels ?? { fail: 'Vulnerable', pass: 'Blocked' };
  const findings = lab.attacks
    .map((a) => ({ a, r: evaluation.results.find((r) => r.attackId === a.id)!, sev: severityOf(a.likelihood, a.impact) }))
    .sort((x, y) => SEVERITY_ORDER.indexOf(x.sev) - SEVERITY_ORDER.indexOf(y.sev));
  const enabledControls = lab.controls.filter((c) => enabled.includes(c.id));

  const rows = findings
    .map(
      ({ a, r, sev }, i) => `
      <tr>
        <td>F-${String(i + 1).padStart(2, '0')}</td>
        <td><b>${escapeHtml(a.label)}</b><br/><span class="muted">${escapeHtml(a.technique)}</span></td>
        <td><span class="sev" style="background:${SEV_COLOR[sev]}">${sev.toUpperCase()}</span><br/><span class="muted">L: ${a.likelihood} · I: ${a.impact}</span></td>
        <td>${escapeHtml(labels.fail)}</td>
        <td class="${r.blocked ? 'ok' : 'bad'}">${escapeHtml(r.blocked ? labels.pass : labels.fail)}${r.blocked ? `<br/><span class="muted">${escapeHtml(r.blockedBy.join(' + '))}</span>` : ''}</td>
      </tr>`,
    )
    .join('');

  const details = findings
    .map(
      ({ a, r, sev }, i) => `
      <h3>F-${String(i + 1).padStart(2, '0')} · ${escapeHtml(a.label)} <span class="sev" style="background:${SEV_COLOR[sev]}">${sev.toUpperCase()}</span></h3>
      <p><b>Technique:</b> ${escapeHtml(a.technique)}</p>
      <p><b>Test input:</b></p><pre>${escapeHtml(a.payload)}</pre>
      <p><b>Observed before hardening:</b> ${escapeHtml(a.vulnerable)}</p>
      <pre>${a.log.map(escapeHtml).join('\n')}</pre>
      <p><b>Impact:</b> ${escapeHtml(a.impactText)}</p>
      <p><b>After hardening:</b> ${escapeHtml(r.blocked ? a.blocked : a.vulnerable)}</p>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; color:#0E1430; margin:32px; font-size:12px; line-height:1.5 }
    h1 { font-size:22px; margin:0 } h2 { font-size:15px; margin-top:24px; border-bottom:2px solid #0F766E; padding-bottom:4px }
    h3 { font-size:13px; margin-top:18px } .muted { color:#525C80; font-size:11px }
    table { width:100%; border-collapse:collapse; margin-top:8px } th,td { border:1px solid #D7DDEC; padding:6px; vertical-align:top; text-align:left }
    th { background:#EBEFF8 } .sev { color:#fff; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:700 }
    .ok { color:#047857; font-weight:700 } .bad { color:#B91C1C; font-weight:700 }
    pre { background:#0E1430; color:#C9F5EC; padding:8px; border-radius:6px; white-space:pre-wrap; font-size:10.5px }
    .banner { padding:10px 12px; border-radius:8px; margin:12px 0; font-weight:700 }
    .disclaimer { margin-top:28px; padding:10px; border:1px dashed #B45309; color:#7C2D12; font-size:10.5px }
  </style></head><body>
  <h1>Security Test Report: ${escapeHtml(lab.system)}</h1>
  <div class="muted">${escapeHtml(lab.title)} · ${escapeHtml(lab.category)} · ${escapeHtml(date.toLocaleString())} · Tester: ${escapeHtml(tester || 'Learner')}</div>
  <div class="banner" style="background:${evaluation.allBlocked ? '#D1FAE5' : '#FEE2E2'}">
    Result: ${evaluation.allBlocked ? 'PASS' : 'FAIL'}: ${evaluation.blockedCount}/${evaluation.results.length} tests ${escapeHtml(labels.pass.toLowerCase())} after hardening
  </div>
  <h2>1. Scope</h2>
  <p>${escapeHtml(lab.scenario)}</p>
  <p><b>Objective:</b> ${escapeHtml(lab.objective)}</p>
  <p><b>Expected secure behaviour:</b> ${escapeHtml(lab.expectedSecure)}</p>
  <h2>2. Summary of findings</h2>
  <table><tr><th>ID</th><th>Finding</th><th>Severity</th><th>Baseline</th><th>After hardening</th></tr>${rows}</table>
  <h2>3. Root cause</h2><p>${escapeHtml(lab.vulnerability)}</p>
  <h2>4. Controls applied</h2>
  <ul>${enabledControls.map((c) => `<li><b>${escapeHtml(c.label)}</b>: ${escapeHtml(c.description)}${c.decoyReason ? ` <i>(ineffective: ${escapeHtml(c.decoyReason)})</i>` : ''}</li>`).join('') || '<li>None</li>'}</ul>
  ${evaluation.missingRecommended.length ? `<p><b>Recommended for defense in depth:</b> ${evaluation.missingRecommended.map((c) => escapeHtml(c.label)).join('; ')}</p>` : ''}
  <h2>5. Finding details</h2>${details}
  <h2>6. Remediation</h2><ol>${lab.remediation.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ol>
  <h2>7. References</h2><ul>${lab.references.map((r) => `<li>${escapeHtml(r.title)} (${escapeHtml(r.publisher)}): ${escapeHtml(r.url)}</li>`).join('')}</ul>
  <div class="disclaimer">Training exercise: this is a simulated assessment of a fictional system generated by Learn AI &amp; Agent Security.
  No real system was tested. Severity uses an OWASP-style likelihood × impact matrix.</div>
  </body></html>`;
}

