import { publicAsset } from '../lib/publicAsset';

/**
 * Cinematic header imagery for every training scenario (beef-up step 1,
 * 2026-11-16). One image per scenario id, served from
 * public/scenarios/<id>.jpg. This map is the single place that knows the
 * paths; components render through ScenarioImage, which hides itself if
 * an image is missing so cards and the player fall back to the pre-image
 * layout with no broken-image icon.
 */
export const scenarioImages: Record<string, string> = {
  'mass-casualty': publicAsset('scenarios/mass-casualty.jpg'),
  'hospital-fire': publicAsset('scenarios/hospital-fire.jpg'),
  hazmat: publicAsset('scenarios/hazmat.jpg'),
  'cyber-attack': publicAsset('scenarios/cyber-attack.jpg'),
  'severe-weather': publicAsset('scenarios/severe-weather.jpg'),
  'power-failure': publicAsset('scenarios/power-failure.jpg'),
  'pediatric-surge': publicAsset('scenarios/pediatric-surge.jpg'),
  'water-contamination': publicAsset('scenarios/water-contamination.jpg'),
  'supply-chain': publicAsset('scenarios/supply-chain.jpg'),
  'ed-overcrowding': publicAsset('scenarios/ed-overcrowding.jpg'),
  'patient-elopement': publicAsset('scenarios/patient-elopement.jpg'),
  'code-gray-escalation': publicAsset('scenarios/code-gray-escalation.jpg'),
  'contraband-overdose': publicAsset('scenarios/contraband-overdose.jpg'),
  'med-error-psych': publicAsset('scenarios/med-error-psych.jpg'),
  'active-shooter-lockdown': publicAsset('scenarios/active-shooter-lockdown.jpg'),
  'bomb-threat-campus': publicAsset('scenarios/bomb-threat-campus.jpg'),
  'workplace-violence-staff': publicAsset('scenarios/workplace-violence-staff.jpg'),
  'psychiatric-emergency-transport': publicAsset('scenarios/psychiatric-emergency-transport.jpg'),
  'mass-fatality-planning': publicAsset('scenarios/mass-fatality-planning.jpg'),
  'resource-rationing-crisis': publicAsset('scenarios/resource-rationing-crisis.jpg'),
};

export function getScenarioImage(id: string): string | undefined {
  return scenarioImages[id];
}
