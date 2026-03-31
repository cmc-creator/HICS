import { useState } from 'react';
import { hicsRoles, hicsCategories } from '../data/roles';
import type { HicsRole } from '../types';

export default function RolesPage() {
  const [selectedRole, setSelectedRole] = useState<HicsRole | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredRoles = activeCategory === 'all'
    ? hicsRoles
    : hicsRoles.filter((r) => r.category === activeCategory);

  const commandRole = hicsRoles.find((r) => r.id === 'incident-commander');
  const commandStaff = hicsRoles.filter((r) => r.reportsTo === 'incident-commander' && r.category === 'command');
  const sectionChiefs = hicsRoles.filter(
    (r) => r.reportsTo === 'incident-commander' && r.category !== 'command'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">HICS Roles &amp; Structure</h1>
          <p className="text-blue-200 text-sm mt-1">
            Explore the NyxHICSlab organizational chart and incident command role descriptions
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Org Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-6 text-center">
            HICS Organizational Chart
          </h2>
          <p className="text-center text-xs text-gray-500 mb-4">
            Scroll horizontally on smaller screens and select any role for full details.
          </p>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[980px]">
              {/* Incident Commander */}
              <div className="flex justify-center mb-3">
                {commandRole && (
                  <button
                    onClick={() => setSelectedRole(commandRole)}
                    className="px-6 py-3 rounded-lg text-white text-sm font-bold shadow-md hover:opacity-90 transition-opacity cursor-pointer"
                    style={{ backgroundColor: commandRole.color }}
                  >
                    <div className="text-xs opacity-80 mb-0.5">{commandRole.abbreviation}</div>
                    {commandRole.title}
                  </button>
                )}
              </div>

              <div className="flex justify-center">
                <div className="w-0.5 h-5 bg-gray-400" />
              </div>

              {/* Command Staff row */}
              <div className="flex justify-center">
                <div className="w-full max-w-4xl h-0.5 bg-gray-300" />
              </div>
              <div className="flex justify-center gap-4 mt-1 mb-6">
                {commandStaff.map((role) => (
                  <div key={role.id} className="flex flex-col items-center">
                    <div className="w-0.5 h-3 bg-gray-300" />
                    <button
                      onClick={() => setSelectedRole(role)}
                      className="px-3 py-2 rounded-lg text-white text-xs font-semibold shadow hover:opacity-90 transition-opacity cursor-pointer"
                      style={{ backgroundColor: role.color }}
                    >
                      <div className="opacity-80 mb-0.5">{role.abbreviation}</div>
                      <div className="max-w-28 text-center leading-tight">{role.title}</div>
                    </button>
                  </div>
                ))}
              </div>

              {/* Section Chiefs and direct reports */}
              <div className="grid grid-cols-4 gap-4">
                {sectionChiefs.map((chief) => {
                  const subordinates = hicsRoles.filter((r) => r.reportsTo === chief.id);
                  return (
                    <div key={chief.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                      <button
                        onClick={() => setSelectedRole(chief)}
                        className="w-full px-3 py-2 rounded-lg text-white text-xs font-bold shadow hover:opacity-90 transition-opacity cursor-pointer"
                        style={{ backgroundColor: chief.color }}
                      >
                        <div className="opacity-80 mb-0.5">{chief.abbreviation}</div>
                        <div className="leading-tight">{chief.title}</div>
                      </button>

                      <div className="mt-3">
                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Direct Reports
                        </div>
                        <div className="space-y-1.5">
                          {subordinates.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => setSelectedRole(sub)}
                              className="w-full text-left px-2.5 py-1.5 rounded text-white text-xs font-medium shadow hover:opacity-90 transition-opacity cursor-pointer"
                              style={{ backgroundColor: sub.color }}
                            >
                              <span className="opacity-90 mr-1">{sub.abbreviation}</span>
                              {sub.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Role List + Detail */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Role List */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-800 mb-3">Filter by Section</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {hicsCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeCategory === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={activeCategory === cat.id ? { backgroundColor: cat.color } : {}}
                  >
                    {cat.label.replace(' Section', '').replace(' Staff', '')}
                  </button>
                ))}
              </div>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {filteredRoles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 ${
                      selectedRole?.id === role.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                    <div>
                      <div className="font-medium text-gray-900">{role.title}</div>
                      <div className="text-xs text-gray-500">{role.abbreviation}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Role Detail */}
          <div className="md:col-span-2">
            {selectedRole ? (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div
                      className="inline-block px-3 py-1 rounded-full text-white text-xs font-bold mb-2"
                      style={{ backgroundColor: selectedRole.color }}
                    >
                      {selectedRole.abbreviation}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedRole.title}</h2>
                    {selectedRole.reportsTo && (
                      <p className="text-sm text-gray-500 mt-1">
                        Reports to:{' '}
                        <button
                          className="text-blue-600 hover:underline font-medium"
                          onClick={() => {
                            const parent = hicsRoles.find((r) => r.id === selectedRole.reportsTo);
                            if (parent) setSelectedRole(parent);
                          }}
                        >
                          {hicsRoles.find((r) => r.id === selectedRole.reportsTo)?.title}
                        </button>
                      </p>
                    )}
                  </div>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
                    style={{ backgroundColor: selectedRole.color }}
                  >
                    {selectedRole.abbreviation.slice(0, 2)}
                  </div>
                </div>

                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 text-sm leading-relaxed">{selectedRole.description}</p>
                </div>

                <h3 className="font-bold text-gray-800 mb-3">Key Responsibilities</h3>
                <ul className="space-y-2">
                  {selectedRole.responsibilities.map((resp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                      {resp}
                    </li>
                  ))}
                </ul>

                {/* Subordinates */}
                {(() => {
                  const subs = hicsRoles.filter((r) => r.reportsTo === selectedRole.id);
                  if (subs.length === 0) return null;
                  return (
                    <div className="mt-4 pt-4 border-t">
                      <h3 className="font-bold text-gray-800 mb-2">Direct Reports</h3>
                      <div className="flex flex-wrap gap-2">
                        {subs.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => setSelectedRole(sub)}
                            className="px-3 py-1.5 rounded-full text-white text-xs font-medium hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: sub.color }}
                          >
                            {sub.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center justify-center h-64 text-center">
                <span className="text-4xl mb-3">👆</span>
                <h3 className="text-lg font-semibold text-gray-700">Select a Role</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Click on any role in the org chart or list to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
