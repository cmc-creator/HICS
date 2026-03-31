import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { scenarios } from '../data/scenarios';
import {
  facilityOptions,
  facilityShortLabel,
  getScenarioFacilities,
  normalizeFacility,
  type FacilityType,
} from '../data/facilityProfiles';

const difficultyColors = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-red-100 text-red-700',
};

const typeIcons: Record<string, string> = {
  'Mass Casualty': '🚑',
  'Fire/Evacuation': '🔥',
  'HazMat': '☢️',
  'Infrastructure': '💻',
  'Weather': '🌪️',
  'Utilities': '🔌',
  'Pediatric Surge': '🧸',
  'Public Health': '🧪',
  'Logistics': '📦',
  'Throughput': '🚪',
  Security: '🚨',
  'Behavioral Health': '🧠',
  'Safety': '🛡️',
  'Medication Safety': '💊',
};

export default function ScenariosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedFacility, setSelectedFacility] = useState<FacilityType>(() =>
    normalizeFacility(searchParams.get('facility')),
  );

  const handleFacilityChange = (facility: FacilityType) => {
    setSelectedFacility(facility);

    if (facility === 'all') {
      setSearchParams({});
      return;
    }

    setSearchParams({ facility });
  };

  const visibleScenarios = useMemo(() => {
    return scenarios.filter((scenario) => {
      if (selectedFacility === 'all') {
        return true;
      }

      return getScenarioFacilities(scenario.id, scenario.type).includes(selectedFacility);
    });
  }, [selectedFacility]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">NyxHICSlab Scenarios</h1>
          <p className="text-blue-200 text-sm mt-1">
            Practice psychiatric inpatient response with interactive choices, practical feedback, and a little personality
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Facility Profile</h2>
              <p className="text-xs text-gray-600 mt-1">
                Tailor scenario recommendations by facility type.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="facility-filter" className="text-xs font-semibold text-gray-600">
                Facility:
              </label>
              <select
                id="facility-filter"
                value={selectedFacility}
                onChange={(e) => handleFacilityChange(e.target.value as FacilityType)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {facilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Showing {visibleScenarios.length} scenario{visibleScenarios.length === 1 ? '' : 's'} for this profile.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 motion-stagger">
          {visibleScenarios.map((scenario) => {
            const facilities = getScenarioFacilities(scenario.id, scenario.type);

            return (
            <div key={scenario.id} className="bg-white rounded-xl shadow-sm overflow-hidden card-lift">
              <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{typeIcons[scenario.type] || '⚠️'}</span>
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                        {scenario.type}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold">{scenario.title}</h2>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${difficultyColors[scenario.difficulty]}`}>
                    {scenario.difficulty}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{scenario.description}</p>

                <div className="mb-4 flex flex-wrap gap-2">
                  {facilities.slice(0, 3).map((facility) => (
                    <span
                      key={`${scenario.id}-${facility}`}
                      className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600"
                    >
                      {facilityShortLabel[facility as Exclude<FacilityType, 'all'>]}
                    </span>
                  ))}
                  {facilities.length > 3 && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                      +{facilities.length - 3} more
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-2">Learning Objectives:</h3>
                  <ul className="space-y-1">
                    {scenario.objectives.slice(0, 3).map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                        {obj}
                      </li>
                    ))}
                    {scenario.objectives.length > 3 && (
                      <li className="text-xs text-gray-400 italic">
                        +{scenario.objectives.length - 3} more objectives...
                      </li>
                    )}
                  </ul>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>⏱️ {scenario.duration}</span>
                    <span>📋 {scenario.steps.length} steps</span>
                  </div>
                  <Link
                    to={selectedFacility === 'all' ? `/scenarios/${scenario.id}` : `/scenarios/${scenario.id}?facility=${selectedFacility}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Start Scenario →
                  </Link>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {visibleScenarios.length === 0 && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h3 className="font-bold text-amber-900">No scenarios matched this profile yet</h3>
            <p className="text-amber-700 text-sm mt-1">
              Try a different facility profile, or choose All Facilities to view the full library.
            </p>
          </div>
        )}

        {/* Info Banner */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-bold text-blue-900">About These Scenarios</h3>
              <p className="text-blue-700 text-sm mt-1">
                These scenarios are based on real-world hospital emergency events and are designed to help you
                practice HICS activation, decision-making, and coordination. Each scenario presents realistic
                situations with multiple choice decisions, including psychiatric inpatient operations such as elopement risk, behavioral escalation, and medication safety events. Learn from both correct and incorrect responses, and expect the occasional morale-boosting line.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
