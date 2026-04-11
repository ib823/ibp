import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { TOUR_STEPS } from '@/data/guided-tour';
import { Button } from '@/components/ui5/Ui5Button';
import { X } from 'lucide-react';

const STORAGE_KEY = 'petros_tour_completed';

/** Check if the tour has been completed before */
export function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Mark the tour as completed */
function markTourCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable
  }
}

/** Clear the tour completed flag */
export function resetTourFlag() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

// ── Shared event bus for starting the tour from anywhere ─────────────

type TourListener = () => void;
const listeners: Set<TourListener> = new Set();

export function startTour() {
  listeners.forEach((fn) => fn());
}

function useOnTourStart(cb: TourListener) {
  useEffect(() => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, [cb]);
}

// ── Spotlight positioning ────────────────────────────────────────────

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTargetRect(selector: string | null): SpotlightRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const pad = 8;
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

// ── Tour Component ───────────────────────────────────────────────────

export function GuidedTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const pendingStep = useRef<number | null>(null);

  const currentStep = TOUR_STEPS[step];

  // Auto-start on first visit
  useEffect(() => {
    if (!isTourCompleted()) {
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for external start requests
  const handleStart = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);
  useOnTourStart(handleStart);

  // After route changes, position the spotlight for the pending step
  useEffect(() => {
    if (!active || pendingStep.current === null) return;
    const targetStep = TOUR_STEPS[pendingStep.current];
    if (!targetStep) return;

    // Wait for DOM to settle after navigation
    const timer = setTimeout(() => {
      if (targetStep.target) {
        const el = document.querySelector(targetStep.target);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      setSpotlight(getTargetRect(targetStep.target));
      pendingStep.current = null;
    }, 350);

    return () => clearTimeout(timer);
  }, [location.pathname, active]);

  // Position spotlight when step changes on the same route
  useEffect(() => {
    if (!active || !currentStep) return;
    const timer = setTimeout(() => {
      if (currentStep.target) {
        const el = document.querySelector(currentStep.target);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      setSpotlight(getTargetRect(currentStep.target));
    }, 100);
    return () => clearTimeout(timer);
  }, [step, active, currentStep]);

  // Reposition on resize/scroll
  useEffect(() => {
    if (!active || !currentStep?.target) return;
    const update = () => setSpotlight(getTargetRect(currentStep.target));
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, currentStep]);

  const goToStep = useCallback(
    (nextStep: number) => {
      const target = TOUR_STEPS[nextStep];
      if (!target) return;

      setStep(nextStep);

      if (target.route !== location.pathname) {
        pendingStep.current = nextStep;
        navigate(target.route);
      } else {
        // Same route — spotlight after brief delay
        setTimeout(() => {
          if (target.target) {
            const el = document.querySelector(target.target);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          setSpotlight(getTargetRect(target.target));
        }, 100);
      }
    },
    [location.pathname, navigate],
  );

  const handleNext = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      goToStep(step + 1);
    } else {
      // Tour complete
      setActive(false);
      markTourCompleted();
    }
  }, [step, goToStep]);

  const handleBack = useCallback(() => {
    if (step > 0) goToStep(step - 1);
  }, [step, goToStep]);

  const handleSkip = useCallback(() => {
    setActive(false);
    markTourCompleted();
  }, []);

  if (!active || !currentStep) return null;

  const isLastStep = step === TOUR_STEPS.length - 1;
  const isFirstStep = step === 0;

  // Card positioning: try to place near the spotlight, or center if no target
  const cardStyle = getCardPosition(spotlight);

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Backdrop with spotlight cutout */}
      {spotlight ? (
        <div
          className="absolute inset-0 pointer-events-auto"
          style={{
            background: 'transparent',
            boxShadow: `
              0 0 0 ${spotlight.top}px rgba(0,0,0,0.55) /* top */,
              ${spotlight.left + spotlight.width}px ${spotlight.top}px 0 calc(100vw) rgba(0,0,0,0.55) /* right */,
              0 ${spotlight.top + spotlight.height}px 0 calc(100vh) rgba(0,0,0,0.55) /* bottom */,
              0 ${spotlight.top}px 0 ${spotlight.left}px rgba(0,0,0,0.55) /* left */
            `,
          }}
          onClick={handleSkip}
        >
          {/* Transparent hole over the target */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              borderRadius: 4,
              boxShadow: '0 0 0 4px rgba(59,141,189,0.5)',
            }}
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 bg-black/55 pointer-events-auto"
          onClick={handleSkip}
        />
      )}

      {/* Tour card */}
      <div
        className="absolute bg-white border border-border shadow-xl rounded-lg p-5 w-[380px] max-h-[70vh] overflow-y-auto pointer-events-auto z-[10000]"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close tour"
        >
          <X size={16} />
        </button>

        {/* Step counter */}
        <div className="text-[10px] font-semibold text-petrol uppercase tracking-wider mb-2">
          Step {step + 1} of {TOUR_STEPS.length}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-text-primary mb-3 pr-6">
          {currentStep.title}
        </h3>

        {/* Body */}
        <div className="text-xs text-text-secondary leading-relaxed space-y-2">
          {currentStep.body.split('\n\n').map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-5 pt-3 border-t border-border">
          <button
            onClick={handleSkip}
            className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button variant="outline" size="sm" onClick={handleBack} className="text-xs h-7 px-3">
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="text-xs h-7 px-4 bg-petrol hover:bg-petrol-light text-white"
            >
              {isLastStep ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compute card position relative to the spotlight or center of screen */
function getCardPosition(spotlight: SpotlightRect | null): React.CSSProperties {
  if (!spotlight) {
    // Center on screen
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const cardW = 380;
  const cardH = 300; // approximate
  const gap = 16;

  // Try placing below the spotlight
  const belowTop = spotlight.top + spotlight.height + gap;
  if (belowTop + cardH < viewH) {
    return {
      top: belowTop,
      left: Math.min(Math.max(spotlight.left, 16), viewW - cardW - 16),
    };
  }

  // Try placing above
  const aboveTop = spotlight.top - cardH - gap;
  if (aboveTop > 0) {
    return {
      top: aboveTop,
      left: Math.min(Math.max(spotlight.left, 16), viewW - cardW - 16),
    };
  }

  // Try placing to the right
  const rightLeft = spotlight.left + spotlight.width + gap;
  if (rightLeft + cardW < viewW) {
    return {
      top: Math.min(Math.max(spotlight.top, 16), viewH - cardH - 16),
      left: rightLeft,
    };
  }

  // Try placing to the left
  const leftLeft = spotlight.left - cardW - gap;
  if (leftLeft > 0) {
    return {
      top: Math.min(Math.max(spotlight.top, 16), viewH - cardH - 16),
      left: leftLeft,
    };
  }

  // Fallback: center
  return {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };
}
