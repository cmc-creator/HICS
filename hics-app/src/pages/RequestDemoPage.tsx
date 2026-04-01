import { useState } from 'react';
import { Link } from 'react-router-dom';
import EnterpriseFooter from '../components/EnterpriseFooter';

const LEAD_KEY = 'nyx-sales-leads';

interface Lead {
  name: string;
  email: string;
  organization: string;
  teamSize: string;
  timeline: string;
  goals: string;
  createdAt: string;
}

function saveLead(lead: Lead) {
  const current = localStorage.getItem(LEAD_KEY);
  const parsed = current ? (JSON.parse(current) as Lead[]) : [];
  parsed.push(lead);
  localStorage.setItem(LEAD_KEY, JSON.stringify(parsed));
}

export default function RequestDemoPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [teamSize, setTeamSize] = useState('100-500');
  const [timeline, setTimeline] = useState('30-days');
  const [goals, setGoals] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !email.includes('@') || !organization) {
      setError('Please provide name, organization, and a valid work email.');
      return;
    }

    saveLead({
      name,
      email,
      organization,
      teamSize,
      timeline,
      goals,
      createdAt: new Date().toISOString(),
    });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <header className="nyx-hero text-white py-6 px-4 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-5xl mx-auto">
          <div className="lux-hero-shell">
            <h1 className="text-3xl font-bold lux-title">Request Enterprise Demo</h1>
            <p className="text-blue-200 text-sm mt-2 lux-subtitle">Tell us your goals and we will tailor a command training rollout plan.</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!submitted ? (
          <div className="nyx-panel p-6">
            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lead-name" className="text-xs font-semibold text-gray-600">Full Name</label>
                <input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="lead-email" className="text-xs font-semibold text-gray-600">Work Email</label>
                <input id="lead-email" value={email} onChange={(e) => setEmail(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="lead-org" className="text-xs font-semibold text-gray-600">Organization</label>
                <input id="lead-org" value={organization} onChange={(e) => setOrganization(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="lead-size" className="text-xs font-semibold text-gray-600">Team Size</label>
                <select id="lead-size" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800">
                  <option value="1-99">1-99</option>
                  <option value="100-500">100-500</option>
                  <option value="500-2000">500-2000</option>
                  <option value="2000+">2000+</option>
                </select>
              </div>
              <div>
                <label htmlFor="lead-timeline" className="text-xs font-semibold text-gray-600">Desired Timeline</label>
                <select id="lead-timeline" value={timeline} onChange={(e) => setTimeline(e.target.value)} className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800">
                  <option value="30-days">Within 30 days</option>
                  <option value="60-days">Within 60 days</option>
                  <option value="quarter">This quarter</option>
                  <option value="exploring">Exploring only</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="lead-goals" className="text-xs font-semibold text-gray-600">Primary Goals</label>
                <textarea id="lead-goals" value={goals} onChange={(e) => setGoals(e.target.value)} rows={4} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Tell us what incidents, teams, or compliance targets you need to cover." />
              </div>
              {error && <p className="md:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" className="nyx-button-metal px-5 py-2.5 rounded-lg text-sm font-semibold">Submit Demo Request</button>
                <Link to="/" className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50">Back to Home</Link>
              </div>
            </form>
          </div>
        ) : (
          <div className="nyx-panel p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Request Received</h2>
            <p className="text-gray-600 mt-2">Our enterprise team will contact you with rollout options and pricing guidance.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link to="/login" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold">Go to Login</Link>
              <Link to="/" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Return Home</Link>
            </div>
          </div>
        )}
      </main>
      <EnterpriseFooter />
    </div>
  );
}
