// ════════════════════════════════════════════════════════════════════════
// LoginPage — Mock Microsoft Entra ID SSO flow
//
// Three steps, mirroring the real Microsoft identity stack:
//   1. Identify  — email entry (matches a seeded persona)
//   2. Credential — "Sign in with Microsoft Authenticator" (simulated)
//   3. MFA        — 6-digit verification code (any 6 digits accepted)
//
// This is a POC — no real network calls, no secrets. The production
// SAC implementation will use @azure/msal-browser against the PETROS
// tenant, and role assignments will flow from Entra group membership.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuthStore, useIsAuthenticated } from '@/store/auth-store';
import { PERSONAS, DEFAULT_TENANT } from '@/data/personas';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/engine/auth/types';
import type { User } from '@/engine/auth/types';
import { cn } from '@/lib/utils';
import { Shield, CheckCircle2, ChevronRight, LogIn, AlertCircle, KeyRound } from 'lucide-react';

type Step = 'identify' | 'authenticate' | 'mfa';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useIsAuthenticated();
  const signIn = useAuthStore((s) => s.signIn);

  const returnTo = useMemo(() => {
    const p = new URLSearchParams(location.search).get('returnTo');
    return p && p.startsWith('/') ? p : '/';
  }, [location.search]);

  // If already authenticated, skip the login flow
  useEffect(() => {
    if (isAuthenticated) navigate(returnTo, { replace: true });
  }, [isAuthenticated, navigate, returnTo]);

  const [step, setStep] = useState<Step>('identify');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Focus the first input of each step as it mounts — accessibility
  const emailRef = useRef<HTMLInputElement>(null);
  const mfaRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === 'identify') emailRef.current?.focus();
    if (step === 'mfa') mfaRef.current?.focus();
  }, [step]);

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const match = PERSONAS.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
    if (!match) {
      setError(`No account found for "${email}". Try one of the demo personas below.`);
      return;
    }
    setSelected(match);
    setStep('authenticate');
  };

  const handleAuthenticate = () => {
    setError(null);
    setStep('mfa');
  };

  const handleMfa = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(mfaCode)) {
      setError('Enter the 6-digit code from Microsoft Authenticator.');
      return;
    }
    if (!selected) {
      setError('Session expired — please start over.');
      setStep('identify');
      return;
    }
    signIn(selected, new Date().toISOString(), DEFAULT_TENANT);
    navigate(returnTo, { replace: true });
  };

  const handlePersonaClick = (p: User) => {
    setEmail(p.email);
    setSelected(p);
    setError(null);
    setStep('authenticate');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1628] via-[#0F2138] to-[#1E3A5F] flex flex-col">
      {/* Top brand bar */}
      <header className="px-5 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center border border-white/20">
            <span className="text-xs font-semibold tracking-wider">IPS</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">PETROS IPS</div>
            <div className="text-[10px] text-white/60 uppercase tracking-wider">Integrated Planning System</div>
          </div>
        </div>
        <span className="text-[10px] font-semibold tracking-wider uppercase text-amber bg-amber/20 border border-amber/30 px-2 py-0.5 rounded">
          POC
        </span>
      </header>

      {/* Card */}
      <main id="main-content" className="flex-1 flex items-start sm:items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-[440px] bg-white shadow-2xl border border-border rounded-sm">
          {/* Step header */}
          <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-border">
            <StepIndicator step={step} />
          </div>

          <div className="px-5 sm:px-6 py-5 sm:py-6">
            {step === 'identify' && (
              <form onSubmit={handleIdentify} aria-labelledby="login-title" noValidate>
                <h1 id="login-title" className="text-lg font-semibold text-text-primary">Sign in</h1>
                <p className="text-xs text-text-secondary mt-1">
                  Use your PETROS corporate account. Federated through Microsoft Entra ID.
                </p>

                <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider mt-5 mb-1" htmlFor="email">
                  Email or UPN
                </label>
                <input
                  id="email"
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="someone@petros.com.my"
                  className="w-full h-11 px-3 text-sm border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-petrol focus:border-petrol"
                  aria-describedby={error ? 'login-error' : undefined}
                />

                {error && (
                  <p id="login-error" role="alert" className="flex items-start gap-1.5 text-xs text-danger mt-2">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full mt-5 h-11 bg-petrol hover:bg-petrol-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  Next
                  <ChevronRight size={16} aria-hidden="true" />
                </button>

                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">Demo personas</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <ul className="space-y-1.5" aria-label="Demo personas">
                  {PERSONAS.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => handlePersonaClick(p)}
                        className="w-full flex items-center gap-3 p-2 border border-border hover:border-petrol/40 hover:bg-content-alt/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol text-left transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-petrol/10 text-petrol text-[11px] font-semibold flex items-center justify-center shrink-0" aria-hidden="true">
                          {p.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-text-primary truncate">{p.displayName}</div>
                          <div className="text-[10px] text-text-muted truncate">{p.email}</div>
                        </div>
                        <span
                          className={cn(
                            'text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border shrink-0',
                            roleChipClass(p.role),
                          )}
                        >
                          {ROLE_LABELS[p.role]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-text-muted mt-3 leading-relaxed">
                  In Phase 1a, demo personas will be replaced by your real Entra ID
                  account. Role assignments will flow from Entra group membership.
                </p>
              </form>
            )}

            {step === 'authenticate' && selected && (
              <>
                <h1 className="text-lg font-semibold text-text-primary">Verify it's you</h1>
                <div className="flex items-center gap-3 mt-3 p-3 bg-content-alt/50 border border-border">
                  <div className="w-10 h-10 rounded-full bg-petrol text-white text-sm font-semibold flex items-center justify-center" aria-hidden="true">
                    {selected.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text-primary truncate">{selected.displayName}</div>
                    <div className="text-xs text-text-muted truncate">{selected.email}</div>
                  </div>
                </div>
                <div className="mt-5 flex items-start gap-2 p-3 border border-petrol/20 bg-petrol/5 text-xs text-text-primary">
                  <Shield size={14} className="text-petrol shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Approve the sign-in in your <strong>Microsoft Authenticator</strong> app on your PETROS-registered device, then enter the 6-digit code on the next screen.
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row-reverse gap-2 mt-5">
                  <button
                    type="button"
                    onClick={handleAuthenticate}
                    className="h-11 px-4 bg-petrol hover:bg-petrol-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol text-white text-sm font-semibold flex-1 sm:flex-none sm:min-w-[160px] flex items-center justify-center gap-2"
                  >
                    <LogIn size={14} aria-hidden="true" />
                    Approve & continue
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep('identify'); setError(null); }}
                    className="h-11 px-4 border border-border hover:bg-content-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol text-sm text-text-primary"
                  >
                    Use a different account
                  </button>
                </div>
                <p className="text-[10px] text-text-muted mt-4 leading-relaxed">
                  Signing in as <strong>{ROLE_LABELS[selected.role]}</strong> — {ROLE_DESCRIPTIONS[selected.role]}
                </p>
              </>
            )}

            {step === 'mfa' && selected && (
              <form onSubmit={handleMfa} aria-labelledby="mfa-title" noValidate>
                <h1 id="mfa-title" className="text-lg font-semibold text-text-primary">Enter verification code</h1>
                <p className="text-xs text-text-secondary mt-1">
                  Enter the 6-digit code from Microsoft Authenticator. In this POC, any 6-digit code is accepted.
                </p>

                <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider mt-5 mb-1" htmlFor="mfa-code">
                  Verification code
                </label>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                  <input
                    id="mfa-code"
                    ref={mfaRef}
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full h-11 pl-9 pr-3 text-sm tracking-[0.4em] font-data text-center border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-petrol focus:border-petrol"
                    placeholder="••••••"
                    aria-describedby={error ? 'mfa-error' : undefined}
                  />
                </div>

                {error && (
                  <p id="mfa-error" role="alert" className="flex items-start gap-1.5 text-xs text-danger mt-2">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </p>
                )}

                <div className="flex flex-col sm:flex-row-reverse gap-2 mt-5">
                  <button
                    type="submit"
                    disabled={mfaCode.length !== 6}
                    className="h-11 px-4 bg-petrol hover:bg-petrol-light disabled:bg-border disabled:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol text-white text-sm font-semibold flex-1 sm:flex-none sm:min-w-[140px] flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep('authenticate'); setMfaCode(''); setError(null); }}
                    className="h-11 px-4 border border-border hover:bg-content-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol text-sm text-text-primary"
                  >
                    Back
                  </button>
                </div>
                <p className="text-[10px] text-text-muted mt-4 leading-relaxed">
                  Demo hint: enter any 6 digits (e.g. <span className="font-data">000000</span>).
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-5 sm:px-8 py-4 text-center text-[10px] text-white/50 leading-relaxed">
        PETROS IPS — Proof of Concept. Not connected to production Entra ID. Sample data derived from publicly
        available Sarawak offshore analogues. © ABeam Consulting Malaysia.
      </footer>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'identify', label: 'Identify' },
    { key: 'authenticate', label: 'Authenticate' },
    { key: 'mfa', label: 'Verify' },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-1" aria-label="Sign-in progress">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <li key={s.key} className="flex items-center flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={cn(
                  'w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-semibold shrink-0',
                  active && 'bg-petrol border-petrol text-white',
                  done && 'bg-success border-success text-white',
                  !active && !done && 'border-border text-text-muted',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <CheckCircle2 size={12} aria-hidden="true" /> : i + 1}
              </div>
              <span className={cn(
                'text-[10px] uppercase tracking-wider font-semibold truncate',
                active ? 'text-petrol' : done ? 'text-success' : 'text-text-muted',
              )}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('flex-1 h-px mx-2', done ? 'bg-success' : 'bg-border')} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function roleChipClass(role: string): string {
  switch (role) {
    case 'analyst':  return 'bg-petrol/10 text-petrol border-petrol/30';
    case 'reviewer': return 'bg-amber/10 text-amber border-amber/30';
    case 'approver': return 'bg-success/10 text-success border-success/30';
    case 'admin':    return 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/30';
    default:         return 'bg-content-alt text-text-secondary border-border';
  }
}
