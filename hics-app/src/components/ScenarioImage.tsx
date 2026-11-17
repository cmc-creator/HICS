import { useState } from 'react';
import { getScenarioImage } from '../data/scenarioImages';

interface ScenarioImageProps {
  scenarioId: string;
  title: string;
  className?: string;
  /** Above-the-fold hero (ScenarioPlayer) loads eager; catalog thumbs lazy. */
  eager?: boolean;
}

/**
 * Scenario artwork with a graceful fallback: if the image is missing or
 * fails to load, this renders nothing and the surrounding card/header
 * looks exactly as it did before scenario imagery shipped - no
 * broken-image icon, no empty frame.
 */
export default function ScenarioImage({ scenarioId, title, className, eager = false }: ScenarioImageProps) {
  const [failed, setFailed] = useState(false);
  const src = getScenarioImage(scenarioId);

  if (!src || failed) {
    return null;
  }

  return (
    <img
      src={src}
      alt={title}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
