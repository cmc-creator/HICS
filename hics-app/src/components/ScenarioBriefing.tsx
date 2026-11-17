import { useRef, useState } from 'react';
import { getScenarioBriefing, getScenarioImage } from '../data/scenarioImages';

interface ScenarioBriefingProps {
  scenarioId: string;
  title: string;
  /** User chose to move on (watched it end, or skipped) - show step 1. */
  onBegin: () => void;
  /** The video file is missing or failed to load - drop the panel for good. */
  onUnavailable: () => void;
}

/**
 * Situation Briefing panel (beef-up step 4): a short ambient video of the
 * scenario still, shown before step 1 for scenarios that have one. Mirrors
 * ScenarioImage's graceful fallback - if the video is missing or errors,
 * this renders nothing and tells the player to start the run exactly as
 * it did before briefings shipped.
 *
 * Motion rules: the video never autoplays with sound (autoplay is muted),
 * and when the user prefers reduced motion it does not autoplay at all -
 * the poster and a large play button wait for a deliberate tap.
 */
export default function ScenarioBriefing({ scenarioId, title, onBegin, onUnavailable }: ScenarioBriefingProps) {
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  const src = getScenarioBriefing(scenarioId);
  const poster = getScenarioImage(scenarioId);

  if (!src || failed) {
    return null;
  }

  const handleError = () => {
    setFailed(true);
    onUnavailable();
  };

  return (
    <section aria-label="Situation briefing" className="nyx-panel p-4 mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
          Situation Briefing
        </h2>
        <span className="text-xs text-gray-500">Watch the scene, then make your first call</span>
      </div>

      <div className="relative">
        <video
          ref={videoRef}
          className="scenario-briefing-video"
          poster={poster}
          controls
          playsInline
          preload="auto"
          autoPlay={!reducedMotion}
          muted={!reducedMotion}
          onPlay={() => setPlaying(true)}
          onEnded={() => setEnded(true)}
          aria-label={`Situation briefing video for ${title}`}
        >
          <source src={src} type="video/mp4" onError={handleError} />
        </video>

        {reducedMotion && !playing && !ended && (
          <button
            type="button"
            onClick={() => void videoRef.current?.play()}
            className="scenario-briefing-play"
            aria-label="Play the situation briefing"
          >
            <span className="scenario-briefing-play-disc" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" focusable="false">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
            <span className="text-sm font-semibold">Play briefing</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <p className="text-sm text-gray-600">
          {ended
            ? 'Briefing complete. Step 1 is ready when you are.'
            : 'Thirty seconds of scene-setting before the first decision.'}
        </p>
        <button
          type="button"
          onClick={onBegin}
          className={ended
            ? 'touch-target nyx-button-metal px-5 py-2 rounded-lg text-sm font-semibold'
            : 'touch-target px-5 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/80'}
        >
          {ended ? 'Begin Step 1' : 'Skip briefing'}
        </button>
      </div>
    </section>
  );
}
