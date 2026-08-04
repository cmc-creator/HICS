export interface StoryboardFrame {
  title: string;
  cue: string;
  seconds: number;
}

export interface LearningMediaModule {
  id: string;
  title: string;
  roleTrack: string;
  durationMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  poster: string;
  summary: string;
  objectives: string[];
  frames: StoryboardFrame[];
}

export const learningMediaModules: LearningMediaModule[] = [
  {
    id: 'ic-first-10',
    title: 'Incident Commander: First 10 Minutes',
    roleTrack: 'Command Staff',
    durationMinutes: 8,
    difficulty: 'beginner',
    poster: '/landing/dashboard-mockup.svg',
    summary: 'A guided command briefing covering activation, objective setting, and first operational priorities.',
    objectives: [
      'Activate HICS with clear command transfer language',
      'Set the first operational objectives under pressure',
      'Delegate section-level actions with closed-loop communication',
    ],
    frames: [
      { title: 'Activation trigger', cue: 'Identify incident scale and declare HICS activation.', seconds: 20 },
      { title: 'Command stance', cue: 'Assign command roles and confirm section chiefs.', seconds: 22 },
      { title: 'Initial objectives', cue: 'Publish three measurable first-period objectives.', seconds: 24 },
      { title: 'Comms loop', cue: 'Practice read-back and message confirmation cadence.', seconds: 20 },
    ],
  },
  {
    id: 'triage-surge-flow',
    title: 'Triage and Surge Flow in High-Acuity Units',
    roleTrack: 'Operations Section',
    durationMinutes: 11,
    difficulty: 'intermediate',
    poster: '/landing/scenario-mockup.svg',
    summary: 'Rapid triage sequencing with safety overlays, bed surge, and transfer routing decisions in high-acuity inpatient environments.',
    objectives: [
      'Prioritize triage in mixed acuity environments',
      'Coordinate safety and restraint resources responsibly',
      'Route overflow through surge pathways without losing command visibility',
    ],
    frames: [
      { title: 'Scene load', cue: 'Assess intake pressure and classify first arrivals.', seconds: 25 },
      { title: 'Safety watch', cue: 'Assign violence risk and elopement controls.', seconds: 24 },
      { title: 'Bed command', cue: 'Reassign units to absorb immediate surge safely.', seconds: 20 },
      { title: 'Transfer branch', cue: 'Coordinate external transfer while preserving care continuity.', seconds: 22 },
    ],
  },
  {
    id: 'debrief-recovery',
    title: 'Hot Debrief and Recovery Workflow',
    roleTrack: 'Planning and Recovery',
    durationMinutes: 9,
    difficulty: 'advanced',
    poster: '/landing/readiness.svg',
    summary: 'How to transition from active incident operations to structured debrief, documentation, and recovery actions.',
    objectives: [
      'Capture timeline and decision points for after-action review',
      'Document clinical and operational recovery risks',
      'Run a concise stress-informed team debrief',
    ],
    frames: [
      { title: 'Incident closeout', cue: 'Confirm stop criteria and stand down sequence.', seconds: 18 },
      { title: 'Rapid timeline', cue: 'Capture major events and deviations in order.', seconds: 26 },
      { title: 'Learning extraction', cue: 'Identify what worked, what failed, and root causes.', seconds: 24 },
      { title: 'Recovery actions', cue: 'Assign owners and due dates for follow-up tasks.', seconds: 22 },
    ],
  },
];
