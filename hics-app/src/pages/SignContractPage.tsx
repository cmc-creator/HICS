import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApiRequest } from '../lib/apiClient';
import { publicAsset } from '../lib/publicAsset';

// Public electronic signing page (/sign/:token) - no login. The
// emailed link's token is the credential. The customer reads the
// agreement exactly as sent, types their name as their signature,
// checks the ESIGN consent box, and signs. A copy is emailed to
// them (and to Nyx Collective) by the server.

interface SignView {
  status: string;
  organization: string;
  facility: string;
  contactName: string;
  contactEmail: string;
  fields: {
    planTier: string;
    annualFee: number;
    setupFee: number;
    termMonths: number;
    startDate: string;
    governingLaw: string;
  };
  documentText: string;
  documentHash: string | null;
  signatures: Array<{ party: string; name: string; title: string; signedAt: string }>;
  signerTokenExpiresAt: string | null;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; contract: SignView };

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [typedSignature, setTypedSignature] = useState('');
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const result = await publicApiRequest<{ contract: SignView }>(`/sign/${encodeURIComponent(token || '')}`, { method: 'GET' });
        if (live) {
          setLoad({ kind: 'ready', contract: result.contract });
          setName(result.contract.contactName || '');
        }
      } catch (err) {
        if (!live) return;
        const status = (err as Error & { status?: number })?.status;
        if (status === 404) {
          setLoad({ kind: 'invalid' });
        } else if (status === 410) {
          setLoad({ kind: 'expired' });
        } else {
          setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong loading this agreement.' });
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);

  const handleSign = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (name.trim().length < 2) {
      setFormError('Enter your full name.');
      return;
    }
    if (title.trim().length < 2) {
      setFormError('Enter your title.');
      return;
    }
    if (typedSignature.trim() !== name.trim()) {
      setFormError('The typed signature must match your name exactly.');
      return;
    }
    if (!consent) {
      setFormError('Please check the consent box to sign electronically.');
      return;
    }
    setSigning(true);
    try {
      const result = await publicApiRequest<{ contract: SignView; message: string }>(`/sign/${encodeURIComponent(token || '')}`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
          typedSignature: typedSignature.trim(),
          consent: true,
        }),
      });
      setLoad({ kind: 'ready', contract: result.contract });
      setJustSigned(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Signing failed. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <header className="page-head flex items-center gap-4">
          <span className="lux-logo-frame shrink-0">
            <img src={publicAsset('hicslogo.png')} alt="NyxHICSlab logo" className="lux-logo-img h-12 w-12" />
          </span>
          <div>
            <div className="text-xl font-bold lux-title">NyxHICSlab Subscription Agreement</div>
            <p className="page-head-sub text-sm lux-subtitle">Nyx Collective LLC · Electronic signature</p>
          </div>
        </header>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {load.kind === 'loading' && (
          <div aria-busy="true">
            <div className="skeleton-block h-24 rounded-xl" />
            <div className="skeleton-block h-96 rounded-xl mt-4" />
          </div>
        )}

        {load.kind === 'invalid' && (
          <div className="nyx-panel p-8 text-center" role="alert">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">This signing link is not valid</h1>
            <p className="text-sm text-gray-600 dark:text-white/60 mt-2">
              The link may have been replaced by a newer one, or the agreement may have been voided.
              Please check your most recent email from Nyx Collective LLC, or contact info@nyxcollectivellc.com.
            </p>
          </div>
        )}

        {load.kind === 'expired' && (
          <div className="nyx-panel p-8 text-center" role="alert">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">This signing link has expired</h1>
            <p className="text-sm text-gray-600 dark:text-white/60 mt-2">
              Signing links are valid for 14 days. Contact Nyx Collective LLC at info@nyxcollectivellc.com
              and a fresh link will be sent.
            </p>
          </div>
        )}

        {load.kind === 'error' && (
          <div className="nyx-panel p-8 text-center" role="alert">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Something went wrong</h1>
            <p className="text-sm text-gray-600 dark:text-white/60 mt-2">{load.message}</p>
          </div>
        )}

        {load.kind === 'ready' && (
          <div className="space-y-6">
            {justSigned && (
              <div className="nyx-panel p-6 border-green-300" role="status">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Thank you - your signature has been recorded</h1>
                <p className="text-sm text-gray-600 dark:text-white/60 mt-2">
                  A copy of the signed agreement has been emailed to {load.contract.contactEmail}.
                  Nyx Collective LLC will countersign and return the fully executed copy.
                </p>
              </div>
            )}

            {!justSigned && (load.contract.status === 'signed' || load.contract.status === 'completed') && (
              <div className="nyx-panel p-6" role="status">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {load.contract.status === 'completed' ? 'This agreement is fully executed' : 'This agreement has been signed'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-white/60 mt-2">
                  {load.contract.status === 'completed'
                    ? 'Both parties have signed. A copy was emailed to the signer.'
                    : 'The customer signature is recorded below. Nyx Collective LLC will countersign and return the fully executed copy.'}
                </p>
              </div>
            )}

            <section className="nyx-panel p-6 sm:p-8 print-document" aria-label="Agreement document">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Agreement for {load.contract.organization}</h2>
                {load.contract.documentHash && (
                  <span className="text-[11px] text-gray-500 dark:text-white/50 font-mono break-all">
                    SHA-256: {load.contract.documentHash}
                  </span>
                )}
              </div>
              <div className="document-body whitespace-pre-wrap">{load.contract.documentText}</div>
              {load.contract.signatures.length > 0 && (
                <div className="mt-6 border-t border-gray-200 dark:border-white/10 pt-4 space-y-3">
                  {load.contract.signatures.map((signature, index) => (
                    <div key={index}>
                      <div className="signature-script text-2xl text-gray-900 dark:text-white">{signature.name}</div>
                      <div className="text-xs text-gray-500 dark:text-white/50">
                        {signature.name}, {signature.title} · signed {new Date(signature.signedAt).toLocaleString()} (typed electronic signature)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {(load.contract.status === 'sent' || load.contract.status === 'viewed') && !justSigned && (
              <form onSubmit={handleSign} className="nyx-panel p-6 sm:p-8" noValidate>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sign this agreement</h2>
                <p className="text-sm text-gray-600 dark:text-white/60 mt-1">
                  Signing as the authorized representative of {load.contract.organization}.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mt-5">
                  <div>
                    <label htmlFor="sign-name" className="text-xs font-semibold text-gray-600 dark:text-white/60">Full name</label>
                    <input id="sign-name" value={name} onChange={(e) => setName(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor="sign-title" className="text-xs font-semibold text-gray-600 dark:text-white/60">Title</label>
                    <input id="sign-title" value={title} onChange={(e) => setTitle(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Director of Emergency Management" />
                  </div>
                </div>
                <div className="mt-4">
                  <label htmlFor="sign-typed" className="text-xs font-semibold text-gray-600 dark:text-white/60">Type your full name exactly as your signature</label>
                  <input id="sign-typed" value={typedSignature} onChange={(e) => setTypedSignature(e.target.value)} className="nyx-input mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" autoComplete="off" aria-describedby="signature-preview" />
                  <div id="signature-preview" className="mt-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-3 min-h-[64px] flex items-center">
                    {typedSignature ? (
                      <span className="signature-script text-3xl text-gray-900 dark:text-white">{typedSignature}</span>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-white/40">Your signature will appear here</span>
                    )}
                  </div>
                </div>
                <label htmlFor="sign-consent" className="mt-5 flex items-start gap-3 text-sm text-gray-700 dark:text-white/80 cursor-pointer">
                  <input
                    id="sign-consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    I agree to sign this agreement electronically. I understand that my typed signature is the
                    legal equivalent of my handwritten signature under the federal ESIGN Act and the Arizona
                    Uniform Electronic Transactions Act, and that I am authorized to bind {load.contract.organization}.
                  </span>
                </label>
                {formError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-3" role="alert">{formError}</p>
                )}
                <button
                  type="submit"
                  className="nyx-button-metal w-full sm:w-auto px-8 py-3 rounded-lg text-sm font-bold mt-5"
                  disabled={signing}
                >
                  {signing ? 'Recording signature...' : 'Sign Agreement'}
                </button>
                {load.contract.signerTokenExpiresAt && (
                  <p className="text-[11px] text-gray-400 dark:text-white/40 mt-3">
                    This signing link expires {new Date(load.contract.signerTokenExpiresAt).toLocaleString()}.
                  </p>
                )}
              </form>
            )}
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 pb-8 text-center text-xs text-gray-400 dark:text-white/40">
        NyxHICSlab™ · © 2026 Nyx Collective LLC · <a className="underline" href="https://nyxcollectivellc.com">nyxcollectivellc.com</a>
      </footer>
    </div>
  );
}
