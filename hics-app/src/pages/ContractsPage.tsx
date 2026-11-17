import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { publicApiRequest } from '../lib/apiClient';
import { useAuth } from '../lib/authContext';
import { useToast } from '../lib/toast';

// Contracts (owner portal, enterprise-admin only - the route and
// the nav link gate on the session role, and the server enforces
// enterprise-admin on every contracts endpoint regardless).
//
// List + create here; the detail view (ContractDetailPage below)
// carries preview, send/resend/void, the event and signature
// record, the document hash, countersign, and a print-friendly
// signed copy.

export interface ContractCustomer {
  organization: string;
  facility: string;
  contactName: string;
  contactEmail: string;
}

export interface ContractFields {
  planTier: string;
  annualFee: number;
  setupFee: number;
  termMonths: number;
  startDate: string;
  governingLaw: string;
}

export interface ContractEvent {
  type: string;
  at: string;
  by?: string;
}

export interface ContractSignature {
  party: 'customer' | 'nyx';
  name: string;
  title: string;
  email: string;
  signedAt: string;
  method: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ContractRecord {
  id: string;
  templateVersion: number;
  customer: ContractCustomer;
  fields: ContractFields;
  status: string;
  signerTokenExpiresAt: string | null;
  events: ContractEvent[];
  signatures: ContractSignature[];
  documentHash: string | null;
  documentText?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const PLAN_TIER_OPTIONS = [
  { value: 'small', label: 'Small Facility ($1,500-$3,000/yr)' },
  { value: 'community', label: 'Community Hospital ($4,500-$10,000/yr)' },
  { value: 'enterprise', label: 'Health System / Enterprise ($15,000-$25,000/yr)' },
];

export function planTierLabel(value: string): string {
  return {
    small: 'Small Facility',
    community: 'Community Hospital',
    enterprise: 'Health System / Enterprise',
  }[value] ?? value;
}

export function formatMoney(value: number): string {
  return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-gray-100',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100',
    viewed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100',
    signed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100',
    voided: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100',
    expired: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="skeleton-block h-20 rounded-xl" />
      ))}
    </div>
  );
}

export default function ContractsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state.
  const [organization, setOrganization] = useState('');
  const [facility, setFacility] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [planTier, setPlanTier] = useState('community');
  const [annualFee, setAnnualFee] = useState('');
  const [setupFee, setSetupFee] = useState('');
  const [termMonths, setTermMonths] = useState('12');
  const [startDate, setStartDate] = useState('');
  const [governingLaw, setGoverningLaw] = useState('Arizona');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const loadContracts = useCallback(async () => {
    try {
      const result = await publicApiRequest<{ contracts: ContractRecord[] }>('/admin/contracts', { method: 'GET' });
      setContracts(Array.isArray(result?.contracts) ? result.contracts : []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load contracts.');
      setContracts([]);
    }
  }, []);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  const validateCreate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (organization.trim().length < 2) errors.organization = 'Enter the customer organization.';
    if (contactName.trim().length < 2) errors.contactName = 'Enter the signer contact name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) errors.contactEmail = 'Enter a valid contact email.';
    const annual = Number(annualFee);
    if (!annualFee || !Number.isFinite(annual) || annual <= 0) errors.annualFee = 'Enter the annual fee (greater than 0).';
    const setup = Number(setupFee);
    if (setupFee === '' || !Number.isFinite(setup) || setup < 0) errors.setupFee = 'Enter the setup fee (0 is fine).';
    const term = Number(termMonths);
    if (!Number.isInteger(term) || term < 1 || term > 120) errors.termMonths = 'Term must be a whole number of months (1-120).';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errors.startDate = 'Pick a start date.';
    return errors;
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateCreate();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setCreating(true);
    try {
      const result = await publicApiRequest<{ contract: ContractRecord }>('/admin/contracts', {
        method: 'POST',
        body: JSON.stringify({
          customer: {
            organization: organization.trim(),
            facility: facility.trim(),
            contactName: contactName.trim(),
            contactEmail: contactEmail.trim().toLowerCase(),
          },
          fields: {
            planTier,
            annualFee: Number(annualFee),
            setupFee: Number(setupFee),
            termMonths: Number(termMonths),
            startDate,
            governingLaw: governingLaw.trim() || 'Arizona',
          },
        }),
      });
      toast.success(`Draft contract created for ${result.contract.customer.organization}.`);
      navigate(`/admin/contracts/${result.contract.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the contract.');
    } finally {
      setCreating(false);
    }
  };

  const fieldError = (name: string) => (formErrors[name] ? (
    <p className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">{formErrors[name]}</p>
  ) : null);

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="page-head">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold lux-title">Contracts</h1>
              <p className="page-head-sub text-sm mt-1 lux-subtitle">Owner portal - subscription agreements with built-in electronic signature</p>
            </div>
            <button
              type="button"
              className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold no-print"
              onClick={() => setShowCreate((prev) => !prev)}
              aria-expanded={showCreate}
            >
              {showCreate ? 'Close form' : 'New Contract'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {showCreate && (
          <form onSubmit={handleCreate} className="nyx-panel p-5" noValidate>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">New subscription agreement</h2>
            <p className="text-xs text-gray-500 dark:text-white/50 mb-4">
              Fill in the order details. The agreement text is generated from the approved template when you send it -
              you can preview the exact document on the next screen before anything goes to the customer.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contract-organization" className="text-xs font-semibold text-gray-600 dark:text-white/60">Customer organization</label>
                <input id="contract-organization" value={organization} onChange={(e) => setOrganization(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Desert Valley Medical Center" />
                {fieldError('organization')}
              </div>
              <div>
                <label htmlFor="contract-facility" className="text-xs font-semibold text-gray-600 dark:text-white/60">Facility (optional)</label>
                <input id="contract-facility" value={facility} onChange={(e) => setFacility(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Main campus" />
              </div>
              <div>
                <label htmlFor="contract-contact-name" className="text-xs font-semibold text-gray-600 dark:text-white/60">Signer name</label>
                <input id="contract-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Jamie Chen" />
                {fieldError('contactName')}
              </div>
              <div>
                <label htmlFor="contract-contact-email" className="text-xs font-semibold text-gray-600 dark:text-white/60">Signer email</label>
                <input id="contract-contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="name@hospital.org" />
                {fieldError('contactEmail')}
              </div>
              <div>
                <label htmlFor="contract-tier" className="text-xs font-semibold text-gray-600 dark:text-white/60">Plan tier</label>
                <select id="contract-tier" value={planTier} onChange={(e) => setPlanTier(e.target.value)} className="select-comfort mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800">
                  {PLAN_TIER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="contract-start" className="text-xs font-semibold text-gray-600 dark:text-white/60">Start date</label>
                <input id="contract-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                {fieldError('startDate')}
              </div>
              <div>
                <label htmlFor="contract-annual-fee" className="text-xs font-semibold text-gray-600 dark:text-white/60">Annual fee (USD)</label>
                <input id="contract-annual-fee" type="number" min="0" step="0.01" value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="7500" />
                {fieldError('annualFee')}
              </div>
              <div>
                <label htmlFor="contract-setup-fee" className="text-xs font-semibold text-gray-600 dark:text-white/60">Setup fee (USD)</label>
                <input id="contract-setup-fee" type="number" min="0" step="0.01" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="1500" />
                {fieldError('setupFee')}
              </div>
              <div>
                <label htmlFor="contract-term" className="text-xs font-semibold text-gray-600 dark:text-white/60">Term (months)</label>
                <input id="contract-term" type="number" min="1" max="120" step="1" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                {fieldError('termMonths')}
              </div>
              <div>
                <label htmlFor="contract-law" className="text-xs font-semibold text-gray-600 dark:text-white/60">Governing law (state)</label>
                <input id="contract-law" value={governingLaw} onChange={(e) => setGoverningLaw(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button type="submit" className="nyx-button-metal px-5 py-2.5 rounded-lg text-sm font-semibold" disabled={creating}>
                {creating ? 'Creating...' : 'Create Draft'}
              </button>
              <p className="text-xs text-gray-500 dark:text-white/50">Nothing is emailed until you review and send the draft.</p>
            </div>
          </form>
        )}

        {loadError && (
          <div className="nyx-panel p-5 text-sm text-red-700 dark:text-red-300" role="alert">
            {loadError}
            <button type="button" className="ml-3 underline font-semibold" onClick={() => void loadContracts()}>Retry</button>
          </div>
        )}

        {contracts === null ? (
          <SkeletonRows />
        ) : contracts.length === 0 && !loadError ? (
          <div className="nyx-panel p-8 text-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">No contracts yet</h2>
            <p className="text-sm text-gray-600 dark:text-white/60 mt-2 max-w-md mx-auto">
              When a hospital is ready to buy, create the agreement here, preview it, and send it for
              electronic signature - no separate e-sign service needed.
            </p>
            <button type="button" className="nyx-button-metal px-5 py-2.5 rounded-lg text-sm font-semibold mt-4" onClick={() => setShowCreate(true)}>
              Create your first contract
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <Link
                key={contract.id}
                to={`/admin/contracts/${contract.id}`}
                className="nyx-panel card-lift block p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-bold text-gray-900 dark:text-white">{contract.customer.organization}</div>
                    <div className="text-[13px] text-gray-500 dark:text-white/50 mt-1">
                      {contract.customer.contactName} · {contract.customer.contactEmail}
                      {contract.customer.facility ? ` · ${contract.customer.facility}` : ''}
                    </div>
                    <div className="text-[13px] text-gray-500 dark:text-white/50 mt-1">
                      {planTierLabel(contract.fields.planTier)} · {formatMoney(contract.fields.annualFee)}/yr · starts {contract.fields.startDate}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusChip status={contract.status} />
                    <span className="text-[13px] text-gray-400 dark:text-white/40">
                      Updated {new Date(contract.updatedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { user } = useAuth();
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Countersign form.
  const [nyxName, setNyxName] = useState('');
  const [nyxTitle, setNyxTitle] = useState('');
  const [nyxSignature, setNyxSignature] = useState('');
  const [countersignError, setCountersignError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.fullName && !nyxName) {
      setNyxName(user.fullName);
    }
  }, [user, nyxName]);

  const loadContract = useCallback(async () => {
    if (!id) return;
    try {
      const result = await publicApiRequest<{ contract: ContractRecord }>(`/admin/contracts/${id}`, { method: 'GET' });
      setContract(result.contract);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load this contract.');
    }
  }, [id]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  const runAction = async (action: string, path: string, successMessage: string) => {
    if (!id) return;
    setBusyAction(action);
    try {
      const result = await publicApiRequest<{ contract: ContractRecord; emailSent?: boolean }>(path, { method: 'POST' });
      setContract(result.contract);
      if (action === 'send' || action === 'resend') {
        if (result.emailSent) {
          toast.success(successMessage);
        } else {
          toast.error('The contract is ready, but the signing email could not be delivered. Check the email configuration, then resend.');
        }
      } else {
        toast.success(successMessage);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That action failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreview = async () => {
    if (!id) return;
    setBusyAction('preview');
    try {
      const result = await publicApiRequest<{ documentText: string }>(`/admin/contracts/${id}/preview`, { method: 'POST' });
      setPreviewText(result.documentText);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not render the preview.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCountersign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setCountersignError(null);
    if (nyxName.trim().length < 2 || nyxTitle.trim().length < 2) {
      setCountersignError('Enter your name and title.');
      return;
    }
    if (nyxSignature.trim() !== nyxName.trim()) {
      setCountersignError('The typed signature must match your name exactly.');
      return;
    }
    setBusyAction('countersign');
    try {
      const result = await publicApiRequest<{ contract: ContractRecord }>(`/admin/contracts/${id}/countersign`, {
        method: 'POST',
        body: JSON.stringify({ name: nyxName.trim(), title: nyxTitle.trim(), typedSignature: nyxSignature.trim() }),
      });
      setContract(result.contract);
      toast.success('Contract countersigned - fully executed.');
    } catch (err) {
      setCountersignError(err instanceof Error ? err.message : 'Countersign failed.');
    } finally {
      setBusyAction(null);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="nyx-panel p-6 text-sm text-red-700 dark:text-red-300" role="alert">{loadError}</div>
        <Link to="/admin/contracts" className="nyx-link text-sm underline mt-4 inline-block">Back to contracts</Link>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10" aria-busy="true">
        <div className="skeleton-block h-40 rounded-xl" />
        <div className="skeleton-block h-64 rounded-xl mt-4" />
      </div>
    );
  }

  const documentToShow = contract.documentText || previewText;
  const isDraft = contract.status === 'draft';
  const canResend = contract.status === 'sent' || contract.status === 'viewed';
  const canVoid = ['draft', 'sent', 'viewed', 'expired'].includes(contract.status);

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="no-print">
          <Link to="/admin/contracts" className="nyx-link text-sm underline">Back to contracts</Link>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{contract.customer.organization}</h1>
              <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
                {contract.customer.contactName} · {contract.customer.contactEmail}
                {contract.customer.facility ? ` · ${contract.customer.facility}` : ''}
              </p>
            </div>
            <StatusChip status={contract.status} />
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {isDraft && (
              <>
                <button type="button" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold" disabled={busyAction !== null} onClick={() => void handlePreview()}>
                  {busyAction === 'preview' ? 'Rendering...' : previewText ? 'Refresh Preview' : 'Preview Agreement'}
                </button>
                <button type="button" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold" disabled={busyAction !== null} onClick={() => void runAction('send', `/admin/contracts/${contract.id}/send`, `Signing link emailed to ${contract.customer.contactEmail}.`)}>
                  {busyAction === 'send' ? 'Sending...' : 'Send for Signature'}
                </button>
              </>
            )}
            {canResend && (
              <button type="button" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold" disabled={busyAction !== null} onClick={() => void runAction('resend', `/admin/contracts/${contract.id}/resend`, `Signing link re-emailed to ${contract.customer.contactEmail}.`)}>
                {busyAction === 'resend' ? 'Resending...' : 'Resend Signing Link'}
              </button>
            )}
            {(contract.status === 'signed' || contract.status === 'completed') && (
              <button type="button" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold" onClick={() => window.print()}>
                Print / Save Signed Copy
              </button>
            )}
            {canVoid && (
              <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold border border-red-300 text-red-700 dark:border-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" disabled={busyAction !== null} onClick={() => void runAction('void', `/admin/contracts/${contract.id}/void`, 'Contract voided. Any signing link is now dead.')}>
                {busyAction === 'void' ? 'Voiding...' : 'Void Contract'}
              </button>
            )}
          </div>
          {contract.signerTokenExpiresAt && canResend && (
            <p className="text-xs text-gray-500 dark:text-white/50 mt-2">
              Current signing link expires {new Date(contract.signerTokenExpiresAt).toLocaleString()}.
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="nyx-panel p-6 print-document">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              {contract.status === 'completed' ? 'Executed Agreement' : contract.status === 'signed' ? 'Customer-Signed Agreement' : 'Agreement Document'}
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-white/50 mb-4">
              Template version {contract.templateVersion}
              {contract.documentHash ? (
                <> · SHA-256: <span className="font-mono break-all">{contract.documentHash}</span></>
              ) : (
                <> · The document is generated when the contract is sent.</>
              )}
            </p>
            {documentToShow ? (
              <div className="document-body whitespace-pre-wrap">{documentToShow}</div>
            ) : (
              <div className="text-sm text-gray-600 dark:text-white/60 border border-dashed border-gray-300 dark:border-white/15 rounded-lg p-6 text-center">
                <p className="font-semibold text-gray-800 dark:text-white">No document rendered yet</p>
                <p className="mt-2">Use Preview Agreement to see the exact document, or Send for Signature to generate it and email the customer.</p>
                <dl className="mt-4 text-left max-w-sm mx-auto space-y-1">
                  <div className="flex justify-between gap-4"><dt>Plan tier</dt><dd className="font-semibold">{planTierLabel(contract.fields.planTier)}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Annual fee</dt><dd className="font-semibold">{formatMoney(contract.fields.annualFee)}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Setup fee</dt><dd className="font-semibold">{formatMoney(contract.fields.setupFee)}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Term</dt><dd className="font-semibold">{contract.fields.termMonths} months</dd></div>
                  <div className="flex justify-between gap-4"><dt>Start date</dt><dd className="font-semibold">{contract.fields.startDate}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Governing law</dt><dd className="font-semibold">{contract.fields.governingLaw}</dd></div>
                </dl>
              </div>
            )}
          </div>

          <div className="space-y-6 no-print">
            <div className="nyx-panel p-5">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Signatures</h2>
              {contract.signatures.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-white/50">No signatures yet.</p>
              ) : (
                <div className="space-y-3">
                  {contract.signatures.map((signature, index) => (
                    <div key={index} className="rounded-lg border border-gray-200 dark:border-white/10 p-3">
                      <div className="signature-script text-xl text-gray-900 dark:text-white">{signature.name}</div>
                      <div className="text-[13px] text-gray-600 dark:text-white/60 mt-1">
                        {signature.name} · {signature.title}
                      </div>
                      <div className="text-[13px] text-gray-500 dark:text-white/50 mt-1">
                        {signature.party === 'nyx' ? 'Nyx Collective LLC' : contract.customer.organization} · {new Date(signature.signedAt).toLocaleString()} · typed e-signature
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {contract.status === 'signed' && (
              <form onSubmit={handleCountersign} className="nyx-panel p-5" noValidate>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Countersign for Nyx Collective</h2>
                <p className="text-xs text-gray-500 dark:text-white/50 mb-3">The customer has signed. Your countersignature completes the agreement.</p>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="nyx-name" className="text-xs font-semibold text-gray-600 dark:text-white/60">Your name</label>
                    <input id="nyx-name" value={nyxName} onChange={(e) => setNyxName(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="nyx-title" className="text-xs font-semibold text-gray-600 dark:text-white/60">Your title</label>
                    <input id="nyx-title" value={nyxTitle} onChange={(e) => setNyxTitle(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Owner, Nyx Collective LLC" />
                  </div>
                  <div>
                    <label htmlFor="nyx-signature" className="text-xs font-semibold text-gray-600 dark:text-white/60">Type your name to sign</label>
                    <input id="nyx-signature" value={nyxSignature} onChange={(e) => setNyxSignature(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" autoComplete="off" />
                    {nyxSignature && <div className="signature-script text-2xl mt-2 text-gray-900 dark:text-white" aria-hidden="true">{nyxSignature}</div>}
                  </div>
                  {countersignError && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{countersignError}</p>}
                  <button type="submit" className="nyx-button-metal px-4 py-2 rounded-lg text-sm font-semibold w-full" disabled={busyAction !== null}>
                    {busyAction === 'countersign' ? 'Countersigning...' : 'Countersign Agreement'}
                  </button>
                </div>
              </form>
            )}

            <div className="nyx-panel p-5">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">History</h2>
              <ol className="space-y-2">
                {contract.events.map((event, index) => (
                  <li key={index} className="flex gap-3 text-[13px]">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="font-semibold capitalize text-gray-800 dark:text-white">{event.type}</span>
                      <span className="text-gray-500 dark:text-white/50"> · {new Date(event.at).toLocaleString()}</span>
                      {event.by ? <span className="block text-gray-500 dark:text-white/50">{event.by}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-gray-400 dark:text-white/40 mt-3">Created by {contract.createdBy} · Template v{contract.templateVersion}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
