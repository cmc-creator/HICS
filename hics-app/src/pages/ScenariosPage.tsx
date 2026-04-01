import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { scenarios } from '../data/scenarios';
import {
  facilityOptions,
  facilityShortLabel,
  getScenarioFacilities,
  normalizeFacility,
  type FacilityType,
} from '../data/facilityProfiles';
import { trackEvent } from '../lib/trainingAnalytics';
import { useTenant } from '../lib/tenantContext';

const difficultyColors = {
  beginner: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  intermediate: 'bg-amber-100 text-amber-800 border border-amber-300',
  advanced: 'bg-rose-100 text-rose-800 border border-rose-300',
};

const typeColors: Record<string, string> = {
  'Mass Casualty': 'bg-red-100 border-red-300 text-red-700',
  'Fire/Evacuation': 'bg-amber-100 border-amber-300 text-amber-700',
  HazMat: 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700',
  Infrastructure: 'bg-slate-100 border-slate-300 text-slate-700',
  Weather: 'bg-cyan-100 border-cyan-300 text-cyan-700',
  Utilities: 'bg-indigo-100 border-indigo-300 text-indigo-700',
  'Pediatric Surge': 'bg-emerald-100 border-emerald-300 text-emerald-700',
  'Public Health': 'bg-lime-100 border-lime-300 text-lime-700',
  Logistics: 'bg-blue-100 border-blue-300 text-blue-700',
  Throughput: 'bg-violet-100 border-violet-300 text-violet-700',
  Security: 'bg-orange-100 border-orange-300 text-orange-700',
  'Behavioral Health': 'bg-teal-100 border-teal-300 text-teal-700',
  Safety: 'bg-rose-100 border-rose-300 text-rose-700',
  'Medication Safety': 'bg-sky-100 border-sky-300 text-sky-700',
};

const typeImages: Record<string, string> = {
  'Mass Casualty': '/lux-icons/alerts.svg',
  'Fire/Evacuation': '/lux-icons/fire.svg',
  HazMat: '/lux-icons/hazmat.svg',
  Security: '/lux-icons/admin.svg',
  'Behavioral Health': '/lux-icons/assistant.svg',
};

type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';
type DurationFilter = 'all' | 'short' | 'medium' | 'long';
type PlaylistFilter = 'all' | 'security-drills' | 'new-hire-basics' | 'infrastructure-failures' | 'behavioral-safety';

const playlistLabels: Record<PlaylistFilter, string> = {
  all: 'All Scenarios',
  'security-drills': 'Security Drills',
  'new-hire-basics': 'New Hire Basics',
  'infrastructure-failures': 'Infrastructure Failures',
  'behavioral-safety': 'Behavioral Safety',
};

function getScenarioDurationBucket(duration: string): DurationFilter {
  const minutes = Number.parseInt(duration, 10);
  if (!Number.isFinite(minutes) || minutes <= 15) {
    return 'short';
  }

  if (minutes <= 24) {
    return 'medium';
  }

  return 'long';
}

function getPlaylistScenarioIds(playlist: PlaylistFilter): string[] {
  if (playlist === 'all') {
    return scenarios.map((scenario) => scenario.id);
  }

  if (playlist === 'security-drills') {
    return scenarios
      .filter((scenario) => scenario.type === 'Security' || scenario.type === 'Safety')
      .map((scenario) => scenario.id);
  }

  if (playlist === 'new-hire-basics') {
    return scenarios
      .filter((scenario) => scenario.difficulty === 'beginner')
      .map((scenario) => scenario.id);
  }

  if (playlist === 'infrastructure-failures') {
    return scenarios
      .filter((scenario) => ['Infrastructure', 'Utilities', 'Weather'].includes(scenario.type))
      .map((scenario) => scenario.id);
  }

  return scenarios
    .filter((scenario) => ['Behavioral Health', 'Safety', 'Medication Safety'].includes(scenario.type))
    .map((scenario) => scenario.id);
}

export default function ScenariosPage() {
  const { facility: tenantFacility, setFacility: setTenantFacility } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedFacility, setSelectedFacility] = useState<FacilityType>(() =>
    normalizeFacility(searchParams.get('facility')) === 'all'
      ? tenantFacility
      : normalizeFacility(searchParams.get('facility')),
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDuration, setSelectedDuration] = useState<DurationFilter>('all');
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistFilter>('all');

  const typeOptions = useMemo(() => {
    const allTypes = Array.from(new Set(scenarios.map((scenario) => scenario.type)));
    return ['all', ...allTypes];
  }, []);

  const handleFacilityChange = (facility: FacilityType) => {
    setSelectedFacility(facility);
    setTenantFacility(facility);

    if (facility === 'all') {
      setSearchParams({});
      return;
    }

    setSearchParams({ facility });
  };

  useEffect(() => {
    const urlFacility = normalizeFacility(searchParams.get('facility'));
    if (urlFacility === 'all' && selectedFacility !== tenantFacility) {
      setSelectedFacility(tenantFacility);
    }
  }, [tenantFacility, searchParams, selectedFacility]);

  const visibleScenarios = useMemo(() => {
    const playlistIds = new Set(getPlaylistScenarioIds(selectedPlaylist));

    return scenarios.filter((scenario) => {
      const facilityMatch =
        selectedFacility === 'all' ||
        getScenarioFacilities(scenario.id, scenario.type).includes(selectedFacility);

      const difficultyMatch = selectedDifficulty === 'all' || scenario.difficulty === selectedDifficulty;
      const typeMatch = selectedType === 'all' || scenario.type === selectedType;
      const durationMatch =
        selectedDuration === 'all' || getScenarioDurationBucket(scenario.duration) === selectedDuration;
      const playlistMatch = playlistIds.has(scenario.id);

      return facilityMatch && difficultyMatch && typeMatch && durationMatch && playlistMatch;
    });
  }, [selectedFacility, selectedDifficulty, selectedType, selectedDuration, selectedPlaylist]);

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="nyx-hero text-white py-8 md:py-10 px-4 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="lux-orb lux-orb-a" />
        <div className="lux-orb lux-orb-b" />
        <div className="max-w-7xl mx-auto">
          <div className="lux-hero-shell">
            <h1 className="text-2xl md:text-3xl font-bold lux-title">NyxHICSlab Scenarios</h1>
            <p className="text-blue-200 text-sm md:text-base mt-2 lux-subtitle max-w-3xl">
              Practice incident response with curated playlists, facility profiles, and realistic decision pressure.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="nyx-panel p-4 md:p-5 mb-6 space-y-4">
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
                className="select-comfort border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {facilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-600 mb-2">Playlist</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(playlistLabels) as PlaylistFilter[]).map((playlist) => (
                <button
                  key={playlist}
                  type="button"
                  onClick={() => setSelectedPlaylist(playlist)}
                  className={`touch-target px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    selectedPlaylist === playlist
                      ? 'bg-blue-600 text-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-white/40'
                  }`}
                >
                  {playlistLabels[playlist]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="difficulty-filter" className="text-xs font-semibold text-gray-600">Difficulty</label>
              <select
                id="difficulty-filter"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as DifficultyFilter)}
                className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800"
              >
                <option value="all">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label htmlFor="type-filter" className="text-xs font-semibold text-gray-600">Incident Type</label>
              <select
                id="type-filter"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800"
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Types' : type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="duration-filter" className="text-xs font-semibold text-gray-600">Duration</label>
              <select
                id="duration-filter"
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(e.target.value as DurationFilter)}
                className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800"
              >
                <option value="all">Any Length</option>
                <option value="short">Short (15 min or less)</option>
                <option value="medium">Medium (16-24 min)</option>
                <option value="long">Long (25+ min)</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Showing {visibleScenarios.length} scenario{visibleScenarios.length === 1 ? '' : 's'} for this filter set.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 motion-stagger">
          {visibleScenarios.map((scenario) => {
            const facilities = getScenarioFacilities(scenario.id, scenario.type);

            return (
              <div key={scenario.id} className="nyx-panel overflow-hidden card-lift scenario-card-shell">
                <div className="scenario-card-head text-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`h-7 w-7 inline-flex items-center justify-center rounded-full border ${typeColors[scenario.type] || 'bg-slate-100 border-slate-300 text-slate-700'}`}>
                          <img src={typeImages[scenario.type] || '/lux-icons/scenarios.svg'} alt="" className="h-3.5 w-3.5 object-contain" />
                        </span>
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
                      <span>TIME {scenario.duration}</span>
                      <span>STEPS {scenario.steps.length}</span>
                    </div>
                    <Link
                      to={selectedFacility === 'all' ? `/scenarios/${scenario.id}` : `/scenarios/${scenario.id}?facility=${selectedFacility}`}
                      onClick={() => {
                        trackEvent('scenario_start_click', {
                          scenarioId: scenario.id,
                          facility: selectedFacility,
                          playlist: selectedPlaylist,
                        });
                      }}
                      className="touch-target bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
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
            <h3 className="font-bold text-amber-900">No scenarios matched this filter set yet</h3>
            <p className="text-amber-700 text-sm mt-1">
              Try a different playlist or broaden one of your filters.
            </p>
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold tracking-[0.2em] text-blue-700">TIP</span>
            <div>
              <h3 className="font-bold text-blue-900">Facilitator Tip</h3>
              <p className="text-blue-700 text-sm mt-1">
                Use playlists to structure sessions by training objective, then switch facility profiles to quickly
                adapt scenarios for different care environments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
