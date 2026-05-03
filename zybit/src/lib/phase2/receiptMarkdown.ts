import type { RunInsightsResponse } from '@/lib/phase2/types';

function esc(s: string): string {
  return s.replace(/\|/g, '\\|');
}

/**
 * Human-readable receipt for Slack/email — companion to JSON `zybit.receipt.v1`.
 */
export function buildReceiptMarkdown(run: RunInsightsResponse, title?: string): string {
  const lines: string[] = [];
  const header = title ?? `Zybit audit receipt — ${run.siteId}`;
  lines.push(`# ${header}`, '');
  lines.push(
    `**Window:** ${run.window.start} → ${run.window.end}  `,
    `**Generated:** ${run.generatedAt}  `,
    `**Trustworthy gate:** ${run.trustworthy ? 'passed' : 'not met (see warnings)'}  `,
    ''
  );

  const d = run.diagnostics;
  lines.push('## Diagnostics', '');
  lines.push(
    `- Duration: ${Math.round(d.windowDurationMs / 1000)}s wall-time span`,
    `- Events: ${d.totalEvents}`,
    `- Unique sessions: ${d.uniqueSessions}`,
    `- Sources: ${d.sources.join(', ') || '—'}`
  );
  if (d.sourceCounts.length) {
    lines.push(
      '',
      '| Source | Events |',
      '| --- | ---: |',
      ...d.sourceCounts.map((r) => `| ${r.source} | ${r.events} |`)
    );
  }
  lines.push('');

  if (run.warnings.length) {
    lines.push('## Gate warnings', '');
    for (const w of run.warnings) {
      lines.push(`- **${w.code}** (${w.level}): ${w.message}`);
    }
    lines.push('');
  }

  lines.push('## Behavioral findings (Phase 1 engine)', '');
  if (run.findings.length === 0) {
    lines.push('_(None in this window / maxFindings cap.)_', '');
  } else {
    for (const f of run.findings) {
      lines.push(`### ${f.title}`, '', f.summary, '');
      if (f.recommendedChanges?.length) {
        lines.push('**Recommended changes**');
        for (const c of f.recommendedChanges) {
          lines.push(`- ${c}`);
        }
        lines.push('');
      }
    }
  }

  const audit = run.auditReport;
  lines.push('## Audit rules (design & pain)', '');
  if (!audit || audit.findings.length === 0) {
    lines.push(
      audit?.groundedInSnapshots === false
        ? '_No snapshot-grounded audits (configure page snapshots / sync HTML capture)._'
        : '_(No audit findings for this window.)_',
      ''
    );
  } else {
    lines.push(`_Grounded in snapshots: ${audit.groundedInSnapshots ? 'yes' : 'no'}_`, '');
    for (const a of audit.findings) {
      lines.push(`### ${a.title}`, '', `Severity: **${a.severity}** · confidence ${a.confidence}`, '', a.summary, '');
      if (a.recommendation.length) {
        lines.push('**Recommendations**');
        for (const r of a.recommendation) {
          lines.push(`- ${r}`);
        }
        lines.push('');
      }
      if (a.evidence.length) {
        lines.push('| Evidence | Value | Context |');
        lines.push('| --- | --- | --- |');
        for (const ev of a.evidence) {
          const val =
            typeof ev.value === 'number' ? String(ev.value) : esc(String(ev.value));
          lines.push(`| ${esc(ev.label)} | ${val} | ${esc(ev.context ?? '—')} |`);
        }
        lines.push('');
      }
      lines.push('');
    }

    if (audit.diagnostics.length) {
      lines.push('### Rule engine diagnostics', '', '| Rule | Emitted | Skipped |', '| --- | ---: | --- |');
      for (const rd of audit.diagnostics) {
        lines.push(`| ${rd.ruleId} | ${rd.emitted} | ${esc(rd.skippedReason ?? '—')} |`);
      }
      lines.push('');
    }
  }

  lines.push('---', '');
  lines.push(
    '_This receipt is deterministic given the same ingest window and configuration. Narration may evolve; export JSON for machine-readable versions._'
  );

  return lines.join('\n');
}
