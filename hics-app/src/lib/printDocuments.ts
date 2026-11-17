// Shared print documents: the branded completion certificate and the
// After-Action Report (AAR). Both render as standalone HTML documents
// in a print window (the app's established pattern), so the output is
// a clean light document regardless of the app's dark/light theme.
// One renderer per document - call sites pass only data the app
// actually stores, and sections with no backing data are omitted.

import { facilityLabels, type FacilityType } from '../data/facilityProfiles';
import { publicAsset } from './publicAsset';

// Brand palette, matching the values already used across the app
// (plum #5f4390, deep plum #251a2a, gold #baa06a / #9f834f).
const PLUM = '#5f4390';
const PLUM_DEEP = '#251a2a';
const PLUM_PALE = '#efeaf6';
const GOLD = '#baa06a';
const GOLD_DEEP = '#9f834f';
const GOLD_PALE = '#f7efdb';
const INK = '#241f2e';
const MUTED = '#5d556e';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function facilityLabelFor(facility: string): string {
  return facilityLabels[facility as FacilityType] ?? facility;
}

function logoUrl(): string {
  return `${window.location.origin}${publicAsset('hicslogo.png')}`;
}

function openPrintDocument(html: string) {
  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return;
  }

  // window.open returned null: popups are blocked, or the page is
  // running inside a mobile app webview (the store shells), where
  // a new window cannot be created. Fall back to a hidden iframe
  // in this document so certificates and After-Action Reports
  // still print instead of silently doing nothing.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    iframe.remove();
    return;
  }

  frameWindow.document.open();
  frameWindow.document.write(html);
  frameWindow.document.close();

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    window.setTimeout(() => iframe.remove(), 500);
  };
  frameWindow.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 60000);

  frameWindow.focus();
  frameWindow.print();
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function formatDuration(durationSeconds: number): string {
  const total = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) {
    return `${seconds} seconds`;
  }
  return seconds === 0 ? `${minutes} minutes` : `${minutes} min ${seconds} sec`;
}

const BRANCH_OUTCOME_LABELS: Record<string, string> = {
  critical: 'Critical',
  recovering: 'Recovering',
  stable: 'Stable',
  exemplary: 'Exemplary',
};

export function branchOutcomeLabel(outcome: string): string {
  return BRANCH_OUTCOME_LABELS[outcome] ?? outcome;
}

// ---------------------------------------------------------------------------
// Certificate of Completion
// ---------------------------------------------------------------------------

export interface CertificateData {
  recipientName: string;
  scenarioTitle: string;
  /** Facility type key (resolved to its label) or a free-form label. */
  facility: string;
  scorePercent: number;
  /** ISO timestamp of completion. */
  completedAt: string;
  durationSeconds?: number;
}

function goldSealSvg(): string {
  return `<svg class="seal" viewBox="0 0 120 120" role="img" aria-label="NyxHICSlab seal">
    <circle cx="60" cy="60" r="57" fill="${GOLD}" />
    <circle cx="60" cy="60" r="52" fill="none" stroke="#fff8e7" stroke-width="2" stroke-dasharray="3 4" />
    <circle cx="60" cy="60" r="42" fill="${GOLD_DEEP}" />
    <polygon points="60,32 67,50 86,50 71,62 76,81 60,70 44,81 49,62 34,50 53,50" fill="#fff8e7" />
    <text x="60" y="103" text-anchor="middle" font-family="Georgia, serif" font-size="10" letter-spacing="2" fill="#fff8e7">HICS</text>
  </svg>`;
}

export function printCertificate(data: CertificateData) {
  const durationLine =
    typeof data.durationSeconds === 'number'
      ? `<div><span class="meta-label">Duration</span>${escapeHtml(formatDuration(data.durationSeconds))}</div>`
      : '';

  const certificateHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>NyxHICSlab Certificate of Completion</title>
  <style>
    @page { size: landscape; margin: 0.4in; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #ece7f4; margin: 0; padding: 28px; color: ${INK}; }
    .sheet { max-width: 980px; margin: 0 auto; background: #fffef9; border: 10px solid ${PLUM_DEEP}; padding: 10px; }
    .inner { border: 2px solid ${GOLD}; padding: 36px 48px 30px; text-align: center; position: relative; }
    .brand { display: flex; align-items: center; justify-content: center; gap: 14px; }
    .brand img { width: 58px; height: 58px; object-fit: contain; }
    .brand-name { font-size: 26px; font-weight: bold; color: ${PLUM_DEEP}; letter-spacing: 0.04em; text-align: left; line-height: 1.1; }
    .brand-sub { font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: ${GOLD_DEEP}; text-align: left; margin-top: 3px; }
    .rule { height: 3px; background: linear-gradient(to right, transparent, ${GOLD}, transparent); margin: 22px auto 6px; }
    .muted { color: ${MUTED}; letter-spacing: 0.22em; font-size: 11px; text-transform: uppercase; }
    h1 { margin: 10px 0 4px; font-size: 42px; color: ${PLUM_DEEP}; font-weight: normal; letter-spacing: 0.02em; }
    .program { font-size: 15px; color: ${PLUM}; font-style: italic; margin: 0 0 6px; }
    .certifies { margin: 18px 0 0; font-size: 14px; color: ${MUTED}; }
    .name { font-size: 36px; margin: 8px auto 4px; color: ${INK}; font-weight: bold; max-width: 760px; }
    .name-rule { width: 420px; max-width: 80%; height: 2px; background: ${GOLD}; margin: 6px auto 14px; }
    .scenario-label { font-size: 13px; color: ${MUTED}; }
    .scenario { font-size: 23px; color: ${PLUM_DEEP}; margin: 4px 0 14px; font-weight: bold; }
    .score { display: inline-block; padding: 9px 22px; border-radius: 999px; background: ${PLUM}; color: #ffffff; font-weight: 700; font-size: 16px; letter-spacing: 0.03em; }
    .meta { margin: 24px auto 0; display: flex; justify-content: center; gap: 44px; flex-wrap: wrap; font-size: 14px; color: ${INK}; text-align: left; }
    .meta-label { display: block; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: ${GOLD_DEEP}; margin-bottom: 3px; }
    .sign-row { margin-top: 34px; display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; }
    .sign { flex: 0 0 260px; text-align: left; }
    .sign-line { border-bottom: 1.5px solid ${INK}; height: 30px; }
    .sign-label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: ${MUTED}; margin-top: 6px; }
    .seal { width: 104px; height: 104px; flex: 0 0 auto; }
    .date-block { flex: 0 0 200px; text-align: right; font-size: 14px; }
    .footer { margin-top: 26px; font-size: 10px; color: ${MUTED}; letter-spacing: 0.06em; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="inner">
      <div class="brand">
        <img src="${logoUrl()}" alt="NyxHICSlab logo" onerror="this.style.display='none'" />
        <div>
          <div class="brand-name">NyxHICSlab&#8482;</div>
          <div class="brand-sub">Nyx Collective LLC</div>
        </div>
      </div>
      <div class="rule"></div>
      <div class="muted">Hospital Incident Command System Training</div>
      <h1>Certificate of Completion</h1>
      <p class="program">Scenario-Based Incident Command Simulation</p>
      <p class="certifies">This certifies that</p>
      <div class="name">${escapeHtml(data.recipientName)}</div>
      <div class="name-rule"></div>
      <div class="scenario-label">successfully completed the scenario</div>
      <div class="scenario">${escapeHtml(data.scenarioTitle)}</div>
      <div><span class="score">Score: ${data.scorePercent}%</span></div>
      <div class="meta">
        <div><span class="meta-label">Facility</span>${escapeHtml(facilityLabelFor(data.facility))}</div>
        <div><span class="meta-label">Completed</span>${escapeHtml(formatDateTime(data.completedAt))}</div>
        ${durationLine}
      </div>
      <div class="sign-row">
        <div class="sign">
          <div class="sign-line"></div>
          <div class="sign-label">Facilitator Signature</div>
        </div>
        ${goldSealSvg()}
        <div class="date-block">
          <span class="meta-label">Date Issued</span>
          ${escapeHtml(new Date(data.completedAt).toLocaleDateString())}
        </div>
      </div>
      <div class="footer">NyxHICSlab&#8482; is a product of Nyx Collective LLC &middot; &copy; 2026 Nyx Collective LLC &middot; nyxcollectivellc.com</div>
    </div>
  </div>
</body>
</html>`;

  openPrintDocument(certificateHtml);
}

// ---------------------------------------------------------------------------
// After-Action Report
// ---------------------------------------------------------------------------

export interface AarParticipant {
  name: string;
  role: string;
}

export interface AarDecision {
  stepTitle: string;
  choiceText: string;
  isCorrect: boolean;
  feedback: string;
}

export interface AarEvent {
  at: string;
  message: string;
}

export interface AfterActionReportData {
  /** e.g. 'Scenario After-Action Report' or 'Live Drill After-Action Report'. */
  documentLabel: string;
  exerciseTitle: string;
  /** Facility type key (resolved to its label) or a free-form label. */
  facility: string;
  organization?: string;
  /** ISO timestamp of the exercise. */
  exerciseAt: string;
  teamName?: string;
  sessionCode?: string;
  facilitatorName?: string;
  participants: AarParticipant[];
  /** Short run-mode summary, e.g. 'Facilitator-led · Timed mode on'. */
  modeLine?: string;
  durationSeconds?: number;
  scorePercent?: number;
  correctAnswers?: number;
  totalSteps?: number;
  branchOutcome?: string;
  multiplierApplied?: number;
  earnedBadges?: string[];
  objectives?: string[];
  decisions?: AarDecision[];
  events?: AarEvent[];
  strengths?: string[];
  improvements?: string[];
  /** Render ruled blank lines for handwritten facilitator notes. */
  notesLines?: boolean;
}

/**
 * Derives the strengths and improvement items for a scenario run from
 * its recorded decisions. Correct decisions are listed as strengths;
 * missed decisions become constructive improvement items carrying the
 * scenario's own feedback (which explains the recommended action).
 */
export function deriveDecisionFindings(decisions: AarDecision[]): {
  strengths: string[];
  improvements: string[];
} {
  const strengths = decisions
    .filter((decision) => decision.isCorrect)
    .map(
      (decision) =>
        `${decision.stepTitle} - recommended action taken. ${decision.feedback}`,
    );

  const improvements = decisions
    .filter((decision) => !decision.isCorrect)
    .map(
      (decision) =>
        `${decision.stepTitle} - the team chose "${decision.choiceText}". ${decision.feedback}`,
    );

  return { strengths, improvements };
}

export function printAfterActionReport(data: AfterActionReportData) {
  const facts: Array<[string, string]> = [
    ['Facility', facilityLabelFor(data.facility)],
  ];
  if (data.organization) {
    facts.push(['Organization', data.organization]);
  }
  facts.push(['Exercise date', formatDateTime(data.exerciseAt)]);
  if (data.teamName) {
    facts.push(['Team', data.teamName]);
  }
  if (data.sessionCode) {
    facts.push(['Session code', data.sessionCode]);
  }
  if (data.facilitatorName) {
    facts.push(['Facilitator', data.facilitatorName]);
  }
  if (data.modeLine) {
    facts.push(['Run mode', data.modeLine]);
  }
  if (typeof data.durationSeconds === 'number') {
    facts.push(['Duration', formatDuration(data.durationSeconds)]);
  }

  const factRows = facts
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const participantsSection =
    data.participants.length > 0
      ? `<h2>Participants and Roles</h2>
         <table class="data">
           <thead><tr><th style="width:55%">Participant</th><th>HICS Role</th></tr></thead>
           <tbody>${data.participants
             .map(
               (participant) =>
                 `<tr><td>${escapeHtml(participant.name)}</td><td>${escapeHtml(participant.role)}</td></tr>`,
             )
             .join('')}</tbody>
         </table>`
      : '';

  const scoreBlock =
    typeof data.scorePercent === 'number'
      ? `<div class="score-band">
           <div class="score-big">${data.scorePercent}%</div>
           <div class="score-facts">
             ${
               typeof data.correctAnswers === 'number' && typeof data.totalSteps === 'number'
                 ? `<div><strong>${data.correctAnswers} of ${data.totalSteps}</strong> decisions matched the recommended action</div>`
                 : ''
             }
             ${
               data.branchOutcome
                 ? `<div>Branch outcome: <strong>${escapeHtml(branchOutcomeLabel(data.branchOutcome))}</strong></div>`
                 : ''
             }
             ${
               typeof data.multiplierApplied === 'number'
                 ? `<div>Challenge multiplier applied: <strong>x${data.multiplierApplied.toFixed(2)}</strong></div>`
                 : ''
             }
             ${
               data.earnedBadges && data.earnedBadges.length > 0
                 ? `<div class="badges">${data.earnedBadges
                     .map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`)
                     .join('')}</div>`
                 : ''
             }
           </div>
         </div>`
      : '';

  const objectivesSection =
    data.objectives && data.objectives.length > 0
      ? `<h2>Exercise Objectives</h2>
         <ul>${data.objectives.map((objective) => `<li>${escapeHtml(objective)}</li>`).join('')}</ul>`
      : '';

  const decisionsSection =
    data.decisions && data.decisions.length > 0
      ? `<h2>Decision Timeline</h2>
         <table class="data">
           <thead><tr><th style="width:5%">#</th><th style="width:26%">Decision Point</th><th style="width:27%">Choice Made</th><th style="width:12%">Outcome</th><th>Feedback</th></tr></thead>
           <tbody>${data.decisions
             .map(
               (decision, index) =>
                 `<tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(decision.stepTitle)}</strong></td>
                    <td>${escapeHtml(decision.choiceText)}</td>
                    <td><span class="${decision.isCorrect ? 'ok' : 'miss'}">${decision.isCorrect ? 'Recommended' : 'Missed'}</span></td>
                    <td>${escapeHtml(decision.feedback)}</td>
                  </tr>`,
             )
             .join('')}</tbody>
         </table>`
      : '';

  const eventsSection =
    data.events && data.events.length > 0
      ? `<h2>Exercise Timeline</h2>
         <table class="data">
           <thead><tr><th style="width:26%">Time</th><th>Event</th></tr></thead>
           <tbody>${data.events
             .map(
               (event) =>
                 `<tr><td>${escapeHtml(formatDateTime(event.at))}</td><td>${escapeHtml(event.message)}</td></tr>`,
             )
             .join('')}</tbody>
         </table>`
      : '';

  const strengthsSection =
    data.strengths && data.strengths.length > 0
      ? `<h2>Strengths</h2>
         <ul>${data.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';

  const improvementsSection =
    data.improvements && data.improvements.length > 0
      ? `<h2>Improvement Items</h2>
         <ul>${data.improvements.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';

  const notesSection = data.notesLines
    ? `<h2>Facilitator Notes and Improvement Plan</h2>
       <div class="notes"><div></div><div></div><div></div><div></div></div>`
    : '';

  const reportHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>NyxHICSlab After-Action Report - ${escapeHtml(data.exerciseTitle)}</title>
  <style>
    @page { margin: 0.55in; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background: #ffffff; margin: 0; color: ${INK}; font-size: 12.5px; line-height: 1.5; }
    .band { background: ${PLUM_DEEP}; color: #ffffff; padding: 18px 22px; display: flex; align-items: center; gap: 16px; }
    .band img { width: 52px; height: 52px; object-fit: contain; background: #ffffff; border-radius: 8px; padding: 4px; }
    .band .brand { font-size: 11px; letter-spacing: 0.26em; text-transform: uppercase; color: ${GOLD}; }
    .band h1 { margin: 2px 0 0; font-size: 24px; font-family: Georgia, serif; font-weight: normal; }
    .exercise { padding: 16px 22px 0; }
    .exercise .label { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: ${GOLD_DEEP}; }
    .exercise h2.title { margin: 2px 0 0; font-size: 20px; color: ${PLUM_DEEP}; border: none; padding: 0; }
    .body { padding: 6px 22px 0; }
    h2 { font-size: 14px; color: ${PLUM_DEEP}; border-bottom: 2px solid ${GOLD}; padding-bottom: 4px; margin: 20px 0 10px; letter-spacing: 0.02em; }
    table.facts { border-collapse: collapse; width: 100%; margin-top: 12px; }
    table.facts th { text-align: left; width: 170px; padding: 5px 10px 5px 0; color: ${MUTED}; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; vertical-align: top; }
    table.facts td { padding: 5px 0; }
    table.data { border-collapse: collapse; width: 100%; }
    table.data th { background: ${PLUM_PALE}; color: ${PLUM_DEEP}; text-align: left; padding: 6px 8px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; border: 1px solid #ddd5ea; }
    table.data td { padding: 6px 8px; border: 1px solid #e3dded; vertical-align: top; }
    .score-band { display: flex; gap: 20px; align-items: center; background: ${GOLD_PALE}; border: 1px solid ${GOLD}; border-radius: 10px; padding: 14px 18px; margin-top: 14px; }
    .score-big { font-size: 40px; font-weight: 700; color: ${PLUM_DEEP}; font-family: Georgia, serif; }
    .score-facts { font-size: 12.5px; }
    .badges { margin-top: 6px; }
    .badge { display: inline-block; border: 1px solid ${GOLD_DEEP}; color: #6d5518; background: #fffdf4; border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 600; margin-right: 6px; }
    .ok { color: #166534; font-weight: 700; }
    .miss { color: #b91c1c; font-weight: 700; }
    ul { margin: 6px 0 0; padding-left: 18px; }
    li { margin-bottom: 5px; }
    .notes div { border-bottom: 1px solid #c9c2d6; height: 26px; }
    .footer { margin-top: 28px; padding: 12px 22px 0; border-top: 1px solid #ddd5ea; font-size: 10px; color: ${MUTED}; }
  </style>
</head>
<body>
  <div class="band">
    <img src="${logoUrl()}" alt="NyxHICSlab logo" onerror="this.style.display='none'" />
    <div>
      <div class="brand">NyxHICSlab&#8482; &middot; Nyx Collective LLC</div>
      <h1>${escapeHtml(data.documentLabel)}</h1>
    </div>
  </div>
  <div class="exercise">
    <div class="label">Exercise</div>
    <h2 class="title">${escapeHtml(data.exerciseTitle)}</h2>
  </div>
  <div class="body">
    <table class="facts">${factRows}</table>
    ${scoreBlock}
    ${participantsSection}
    ${objectivesSection}
    ${decisionsSection}
    ${eventsSection}
    ${strengthsSection}
    ${improvementsSection}
    ${notesSection}
  </div>
  <div class="footer">
    Generated by NyxHICSlab&#8482; on ${escapeHtml(new Date().toLocaleString())} &middot; NyxHICSlab&#8482; is a product of Nyx Collective LLC &middot; &copy; 2026 Nyx Collective LLC &middot; nyxcollectivellc.com
  </div>
</body>
</html>`;

  openPrintDocument(reportHtml);
}
