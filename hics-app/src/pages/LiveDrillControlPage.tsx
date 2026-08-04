import { useEffect, useMemo, useState } from 'react';
import { hicsRoles } from '../data/roles';
import { deleteLiveDrillSession, getLiveDrillSession, saveLiveDrillSession } from '../lib/trainingAnalytics';

interface DrillEvent {
  at: string;
  message: string;
}

interface Participant {
  name: string;
  roleId: string;
}

interface DrillState {
  id?: string;
  sessionCode: string;
  phaseIndex: number;
  running: boolean;
  elapsedSeconds: number;
  participants: Participant[];
  events: DrillEvent[];
}

const phases = ['Briefing', 'Triage Surge', 'Command Coordination', 'Recovery Debrief'];

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function initialState(): DrillState {
  return {
    sessionCode: randomCode(),
    phaseIndex: 0,
    running: false,
    elapsedSeconds: 0,
    participants: [],
    events: [],
  };
}

export default function LiveDrillControlPage() {
  const [state, setState] = useState<DrillState>(() => initialState());
  const [participantName, setParticipantName] = useState('');
  const [participantRoleId, setParticipantRoleId] = useState('operations-chief');
  const [announcement, setAnnouncement] = useState('');
  const [sessionLookup, setSessionLookup] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const remote = await getLiveDrillSession(state.sessionCode);
      if (cancelled) {
        return;
      }
      if (remote) {
        setState((prev) => ({
          ...prev,
          id: remote.id,
          sessionCode: remote.sessionCode,
          phaseIndex: remote.phaseIndex,
          running: remote.running,
          elapsedSeconds: remote.elapsedSeconds,
          participants: remote.participants,
          events: remote.events,
        }));
      }
      setHydrated(true);
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveLiveDrillSession({
        sessionCode: state.sessionCode,
        phaseIndex: state.phaseIndex,
        running: state.running,
        elapsedSeconds: state.elapsedSeconds,
        participants: state.participants,
        events: state.events,
      }).then((saved) => {
        if (saved) {
          setState((prev) => ({ ...prev, id: saved.id }));
        }
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [state, hydrated]);

  useEffect(() => {
    if (!state.running) {
      return;
    }

    const timer = window.setInterval(() => {
      setState((prev) => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state.running]);

  const elapsedDisplay = useMemo(() => {
    const minutes = Math.floor(state.elapsedSeconds / 60);
    const seconds = state.elapsedSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [state.elapsedSeconds]);

  const pushEvent = (message: string) => {
    setState((prev) => ({
      ...prev,
      events: [{ at: new Date().toISOString(), message }, ...prev.events].slice(0, 30),
    }));
  };

  const toggleRunning = () => {
    setState((prev) => ({ ...prev, running: !prev.running }));
    pushEvent(state.running ? 'Drill paused by facilitator.' : 'Drill resumed by facilitator.');
  };

  const nextPhase = () => {
    setState((prev) => ({ ...prev, phaseIndex: Math.min(phases.length - 1, prev.phaseIndex + 1) }));
    pushEvent('Phase advanced by facilitator.');
  };

  const resetSession = () => {
    void deleteLiveDrillSession(state.sessionCode);
    setState(initialState());
    setStatus('Session reset and persisted.');
  };

  const addParticipant = () => {
    const trimmed = participantName.trim();
    if (!trimmed) {
      return;
    }

    setState((prev) => ({
      ...prev,
      participants: [...prev.participants, { name: trimmed, roleId: participantRoleId }].slice(0, 20),
    }));
    pushEvent(`Participant added: ${trimmed}`);
    setParticipantName('');
  };

  const announce = () => {
    const trimmed = announcement.trim();
    if (!trimmed) {
      return;
    }
    pushEvent(`Broadcast: ${trimmed}`);
    setAnnouncement('');
  };

  const loadBySessionCode = async () => {
    const code = sessionLookup.trim().toUpperCase();
    if (!code) {
      setStatus('Enter a session code to load.');
      return;
    }

    const remote = await getLiveDrillSession(code);
    if (!remote) {
      setStatus(`No session found for code ${code}.`);
      return;
    }

    setState({
      id: remote.id,
      sessionCode: remote.sessionCode,
      phaseIndex: remote.phaseIndex,
      running: remote.running,
      elapsedSeconds: remote.elapsedSeconds,
      participants: remote.participants,
      events: remote.events,
    });
    setStatus(`Loaded session ${remote.sessionCode}.`);
  };

  const createNewSession = () => {
    setState(initialState());
    setSessionLookup('');
    setStatus('New live drill session created locally. It will persist after first action.');
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="nyx-panel p-6 mb-5">
          <p className="text-xs tracking-[0.16em] uppercase text-gray-500">Facilitator Mode</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Live Drill Control Room</h1>
          <p className="text-sm text-gray-600 mt-2">
            Manage role assignments, phase transitions, and live announcements for team drills.
          </p>

          <div className="mt-4 grid sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 bg-white p-3"><strong>Session:</strong> {state.sessionCode}</div>
            <div className="rounded-lg border border-gray-200 bg-white p-3"><strong>Phase:</strong> {phases[state.phaseIndex]}</div>
            <div className="rounded-lg border border-gray-200 bg-white p-3"><strong>Status:</strong> {state.running ? 'Live' : 'Paused'}</div>
            <div className="rounded-lg border border-gray-200 bg-white p-3"><strong>Elapsed:</strong> {elapsedDisplay}</div>
          </div>

          <div className="mt-3 grid sm:grid-cols-[1fr_auto_auto] gap-2">
            <input
              value={sessionLookup}
              onChange={(event) => setSessionLookup(event.target.value)}
              placeholder="Load by session code"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            />
            <button type="button" onClick={() => void loadBySessionCode()} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
              Load Session
            </button>
            <button type="button" onClick={createNewSession} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
              New Session
            </button>
          </div>
          {status && <p className="mt-2 text-xs text-gray-600">{status}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={toggleRunning} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              {state.running ? 'Pause Drill' : 'Start Drill'}
            </button>
            <button type="button" onClick={nextPhase} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
              Advance Phase
            </button>
            <button type="button" onClick={resetSession} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
              Reset Session
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <section className="nyx-panel p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Role Assignments</h2>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
              <input
                value={participantName}
                onChange={(event) => setParticipantName(event.target.value)}
                placeholder="Participant name"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={participantRoleId}
                onChange={(event) => setParticipantRoleId(event.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {hicsRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.title}</option>
                ))}
              </select>
              <button type="button" onClick={addParticipant} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add</button>
            </div>

            <div className="mt-4 space-y-2">
              {state.participants.length === 0 ? (
                <p className="text-sm text-gray-500">No participants assigned yet.</p>
              ) : (
                state.participants.map((participant, index) => (
                  <div key={`${participant.name}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{participant.name}</span>
                    <span className="text-xs text-gray-500">{hicsRoles.find((role) => role.id === participant.roleId)?.abbreviation ?? participant.roleId}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="nyx-panel p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Live Broadcast and Event Feed</h2>
            <div className="flex gap-2">
              <input
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
                placeholder="Broadcast instruction to drill team"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button type="button" onClick={announce} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900">Send</button>
            </div>

            <div className="mt-4 space-y-2 max-h-[420px] overflow-auto pr-1">
              {state.events.length === 0 ? (
                <p className="text-sm text-gray-500">No drill events yet.</p>
              ) : (
                state.events.map((event, index) => (
                  <div key={`${event.at}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-sm text-gray-800">{event.message}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{new Date(event.at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
