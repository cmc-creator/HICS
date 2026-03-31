export type FacilityType =
  | 'all'
  | 'psychiatric-inpatient'
  | 'general-acute-care'
  | 'community-hospital'
  | 'long-term-care'
  | 'ambulatory-care';

export const facilityOptions: Array<{ value: FacilityType; label: string }> = [
  { value: 'all', label: 'All Facilities' },
  { value: 'psychiatric-inpatient', label: 'Psychiatric Inpatient' },
  { value: 'general-acute-care', label: 'General Acute Care Hospital' },
  { value: 'community-hospital', label: 'Community Hospital' },
  { value: 'long-term-care', label: 'Long-Term Care / SNF' },
  { value: 'ambulatory-care', label: 'Ambulatory / Outpatient Center' },
];

export const facilityLabels: Record<FacilityType, string> = {
  all: 'All Facilities',
  'psychiatric-inpatient': 'Psychiatric Inpatient',
  'general-acute-care': 'General Acute Care Hospital',
  'community-hospital': 'Community Hospital',
  'long-term-care': 'Long-Term Care / SNF',
  'ambulatory-care': 'Ambulatory / Outpatient Center',
};

export const facilityShortLabel: Record<Exclude<FacilityType, 'all'>, string> = {
  'psychiatric-inpatient': 'Psych',
  'general-acute-care': 'Acute',
  'community-hospital': 'Community',
  'long-term-care': 'LTC/SNF',
  'ambulatory-care': 'Ambulatory',
};

const defaultFacilitiesByType: Record<string, FacilityType[]> = {
  'Mass Casualty': ['general-acute-care', 'community-hospital'],
  'Fire/Evacuation': ['general-acute-care', 'community-hospital', 'long-term-care', 'psychiatric-inpatient'],
  HazMat: ['general-acute-care', 'community-hospital'],
  Infrastructure: ['general-acute-care', 'community-hospital', 'ambulatory-care', 'long-term-care'],
  Weather: ['general-acute-care', 'community-hospital', 'long-term-care', 'ambulatory-care'],
  Utilities: ['general-acute-care', 'community-hospital', 'long-term-care'],
  'Pediatric Surge': ['general-acute-care', 'community-hospital'],
  'Public Health': ['general-acute-care', 'community-hospital', 'long-term-care', 'ambulatory-care'],
  Logistics: ['general-acute-care', 'community-hospital', 'long-term-care'],
  Throughput: ['general-acute-care', 'community-hospital', 'ambulatory-care'],
  'Behavioral Health': ['psychiatric-inpatient', 'general-acute-care'],
  Safety: ['psychiatric-inpatient', 'general-acute-care', 'long-term-care', 'ambulatory-care'],
  'Medication Safety': ['psychiatric-inpatient', 'general-acute-care', 'long-term-care'],
  Security: ['psychiatric-inpatient', 'general-acute-care', 'community-hospital', 'ambulatory-care'],
};

const scenarioFacilityOverrides: Record<string, FacilityType[]> = {
  'patient-elopement': ['psychiatric-inpatient'],
  'code-gray-escalation': ['psychiatric-inpatient', 'general-acute-care'],
  'contraband-overdose': ['psychiatric-inpatient'],
  'med-error-psych': ['psychiatric-inpatient', 'general-acute-care'],
  'active-shooter-lockdown': ['psychiatric-inpatient', 'general-acute-care', 'community-hospital', 'ambulatory-care'],
  'bomb-threat-campus': ['psychiatric-inpatient', 'general-acute-care', 'community-hospital', 'ambulatory-care'],
  'workplace-violence-staff': ['psychiatric-inpatient', 'general-acute-care', 'long-term-care', 'ambulatory-care'],
};

export function getScenarioFacilities(scenarioId: string, scenarioType: string): FacilityType[] {
  const override = scenarioFacilityOverrides[scenarioId];
  if (override) {
    return override;
  }

  return defaultFacilitiesByType[scenarioType] ?? ['general-acute-care'];
}

export function normalizeFacility(value: string | null): FacilityType {
  if (!value) {
    return 'all';
  }

  const allowed: FacilityType[] = [
    'all',
    'psychiatric-inpatient',
    'general-acute-care',
    'community-hospital',
    'long-term-care',
    'ambulatory-care',
  ];

  return allowed.includes(value as FacilityType) ? (value as FacilityType) : 'all';
}

export function adaptScenarioText(text: string, facility: FacilityType): string {
  if (facility === 'all' || facility === 'psychiatric-inpatient') {
    return text;
  }

  let adapted = text;

  if (facility === 'general-acute-care') {
    adapted = adapted
      .replace(/locked psychiatric inpatient unit/gi, 'high-observation inpatient unit')
      .replace(/locked psych unit/gi, 'high-observation unit')
      .replace(/psych unit/gi, 'inpatient unit')
      .replace(/psychiatric inpatient/gi, 'hospital inpatient')
      .replace(/behavioral health unit/gi, 'inpatient care unit');
  }

  if (facility === 'community-hospital') {
    adapted = adapted
      .replace(/locked psychiatric inpatient unit/gi, 'community inpatient unit')
      .replace(/locked psych unit/gi, 'community inpatient unit')
      .replace(/psych unit/gi, 'community inpatient unit')
      .replace(/psychiatric inpatient/gi, 'community hospital')
      .replace(/behavioral health unit/gi, 'community care unit');
  }

  if (facility === 'long-term-care') {
    adapted = adapted
      .replace(/locked psychiatric inpatient unit/gi, 'secured resident care wing')
      .replace(/locked psych unit/gi, 'secured resident wing')
      .replace(/psych unit/gi, 'resident care wing')
      .replace(/\bpatients\b/gi, 'residents')
      .replace(/\bpatient\b/gi, 'resident')
      .replace(/behavioral health unit/gi, 'long-term care wing');
  }

  if (facility === 'ambulatory-care') {
    adapted = adapted
      .replace(/locked psychiatric inpatient unit/gi, 'outpatient treatment area')
      .replace(/locked psych unit/gi, 'outpatient area')
      .replace(/psych unit/gi, 'clinic area')
      .replace(/inpatient/gi, 'outpatient')
      .replace(/behavioral health unit/gi, 'ambulatory care area');
  }

  return adapted;
}
