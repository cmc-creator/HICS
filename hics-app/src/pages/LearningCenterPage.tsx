import { useEffect, useMemo, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { learningMediaModules } from '../data/learningMedia';
import {
  deleteLearningMediaAsset,
  getLearningMediaAssets,
  type LearningMediaAsset,

  uploadLearningMediaAsset,
} from '../lib/trainingAnalytics';

const STORAGE_KEY = 'nyx-learning-module-progress';

function readCompleted(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCompleted(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function LearningCenterPage() {
  const [activeModuleId, setActiveModuleId] = useState(learningMediaModules[0]?.id ?? '');
  const [frameIndex, setFrameIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>(() => readCompleted());
  const [mediaAssets, setMediaAssets] = useState<LearningMediaAsset[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const activeModule = useMemo(
    () => learningMediaModules.find((module) => module.id === activeModuleId) ?? learningMediaModules[0],
    [activeModuleId],
  );

  const completionPercent = Math.round((completedIds.length / Math.max(1, learningMediaModules.length)) * 100);

  useEffect(() => {
    if (!activeModule) {
      return;
    }

    let cancelled = false;
    void getLearningMediaAssets(activeModule.id).then((assets) => {
      if (!cancelled) {
        setMediaAssets(assets);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeModule]);

  if (!activeModule) {
    return null;
  }

  const frame = activeModule.frames[Math.min(frameIndex, activeModule.frames.length - 1)];

  const markComplete = () => {
    if (completedIds.includes(activeModule.id)) {
      return;
    }

    const next = [...completedIds, activeModule.id];
    setCompletedIds(next);
    writeCompleted(next);
  };

  const resetProgress = () => {
    setCompletedIds([]);
    writeCompleted([]);
  };

  const refreshMedia = async () => {
    if (!activeModule) {
      return;
    }
    const assets = await getLearningMediaAssets(activeModule.id);
    setMediaAssets(assets);
  };

  const uploadStream = async () => {
    if (!activeModule) {
      return;
    }

    const trimmedTitle = uploadTitle.trim();
    const trimmedUrl = streamUrl.trim();
    if (!trimmedTitle || !trimmedUrl) {
      setStatus('Title and stream URL are required.');
      return;
    }

    setBusy(true);
    setStatus('Saving stream source...');
    const saved = await uploadLearningMediaAsset({
      moduleId: activeModule.id,
      title: trimmedTitle,
      sourceType: 'stream',
      videoUrl: trimmedUrl,
      description: uploadDescription.trim() || undefined,
    });
    setBusy(false);

    if (!saved) {
      setStatus('Unable to save stream source right now.');
      return;
    }

    setUploadTitle('');
    setStreamUrl('');
    setUploadDescription('');
    setStatus('Stream source saved.');
    await refreshMedia();
  };

  const uploadVideoFile = async () => {
    if (!activeModule || !uploadFile) {
      setStatus('Choose a video file before uploading.');
      return;
    }

    if (!uploadFile.type.startsWith('video/')) {
      setStatus('Selected file is not a video.');
      return;
    }

    const trimmedTitle = (uploadTitle || uploadFile.name).trim();
    if (!trimmedTitle) {
      setStatus('Title is required for uploaded videos.');
      return;
    }

    const safeFilename = uploadFile.name
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]|[-.]$/g, '')
      .slice(0, 80) || 'upload-video';
    const pathname = `learning-media/${activeModule.id}/${Date.now()}-${safeFilename}`;

    setBusy(true);
    setStatus('Uploading to Vercel Blob...');

    try {
      const blob = await upload(pathname, uploadFile, {
        access: 'public',
        handleUploadUrl: '/api/training/media/upload-url',
      });

      setStatus('Finalizing media record...');
      const saved = await uploadLearningMediaAsset({
        moduleId: activeModule.id,
        title: trimmedTitle,
        sourceType: 'upload',
        videoUrl: blob.url,
        description: uploadDescription.trim() || undefined,
        mimeType: uploadFile.type,
        bytes: uploadFile.size,
        storageKey: blob.pathname,
        storageProvider: 'vercel-blob',
      });

      if (!saved) {
        setStatus('Upload succeeded but media metadata save failed.');
        setBusy(false);
        return;
      }

      setUploadTitle('');
      setUploadDescription('');
      setUploadFile(null);
      setStatus('Video uploaded successfully.');
      await refreshMedia();
    } catch {
      setStatus('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const removeAsset = async (assetId: string) => {
    setBusy(true);
    const ok = await deleteLearningMediaAsset(assetId);
    setBusy(false);
    setStatus(ok ? 'Media asset removed.' : 'Could not remove media asset.');
    if (ok) {
      await refreshMedia();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="nyx-panel p-6 mb-6">
          <p className="text-xs tracking-[0.16em] uppercase text-gray-500">Learning Center</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Video-Style Storyboard Academy</h1>
          <p className="text-sm text-gray-600 mt-2 max-w-3xl">
            This hub delivers guided, frame-based incident walkthroughs with role-specific learning objectives.
            Each storyboard simulates a short training video sequence even when local media files are not bundled.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              Completion: {completionPercent}%
            </span>
            <button
              type="button"
              onClick={resetProgress}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              Reset Learning Progress
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          <aside className="nyx-panel p-4">
            <h2 className="text-sm font-bold text-gray-800 mb-3">Modules</h2>
            <div className="space-y-2">
              {learningMediaModules.map((module) => {
                const selected = module.id === activeModule.id;
                const completed = completedIds.includes(module.id);
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => {
                      setActiveModuleId(module.id);
                      setFrameIndex(0);
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-3 transition ${
                      selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-xs text-gray-500">{module.roleTrack}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{module.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{module.durationMinutes} min</span>
                      <span className="text-[11px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 uppercase">{module.difficulty}</span>
                      {completed && <span className="text-[11px] rounded-full bg-green-100 px-2 py-0.5 text-green-700">Completed</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="nyx-panel p-5">
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-slate-900">
              <img src={activeModule.poster} alt="module poster" className="w-full h-56 object-cover opacity-85" />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{activeModule.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{activeModule.summary}</p>
              </div>
              <button
                type="button"
                onClick={markComplete}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Mark Module Complete
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-[0.14em]">Storyboard Frame</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{frame.title}</p>
              <p className="text-sm text-gray-700 mt-1">{frame.cue}</p>
              <p className="text-xs text-gray-500 mt-2">Suggested narration time: {frame.seconds}s</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFrameIndex((idx) => Math.max(0, idx - 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white"
                >
                  Previous Frame
                </button>
                <button
                  type="button"
                  onClick={() => setFrameIndex((idx) => Math.min(activeModule.frames.length - 1, idx + 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white"
                >
                  Next Frame
                </button>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-800 mb-2">Learning Objectives</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {activeModule.objectives.map((objective) => (
                  <li key={objective} className="rounded-lg border border-gray-200 bg-white p-3">{objective}</li>
                ))}
              </ul>
            </div>

            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-bold text-gray-800">Video Library</h3>
              <p className="text-xs text-gray-600 mt-1">
                Add direct stream URLs or upload short MP4 clips for this module.
              </p>

              <div className="mt-3 grid lg:grid-cols-2 gap-3">
                <input
                  value={uploadTitle}
                  onChange={(event) => setUploadTitle(event.target.value)}
                  placeholder="Video title"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <input
                  value={streamUrl}
                  onChange={(event) => setStreamUrl(event.target.value)}
                  placeholder="https://... direct stream URL"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <input
                  value={uploadDescription}
                  onChange={(event) => setUploadDescription(event.target.value)}
                  placeholder="Description (optional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={uploadStream}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Save Stream Source
                </button>
                <button
                  type="button"
                  disabled={busy || !uploadFile}
                  onClick={uploadVideoFile}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  Upload Video File
                </button>
              </div>

              {status && <p className="mt-2 text-xs text-gray-600">{status}</p>}

              <div className="mt-4 space-y-3">
                {mediaAssets.length === 0 ? (
                  <p className="text-sm text-gray-500">No uploaded or streamed videos for this module yet.</p>
                ) : (
                  mediaAssets.map((asset) => (
                    <div key={asset.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{asset.title}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {asset.sourceType === 'upload' ? 'Uploaded clip' : 'Stream source'} · {new Date(asset.createdAt).toLocaleString()}
                          </p>
                          {asset.description && <p className="text-xs text-gray-600 mt-1">{asset.description}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeAsset(asset.id)}
                          className="rounded-lg border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                      <video
                        controls
                        preload="metadata"
                        className="mt-3 w-full max-h-80 rounded-lg border border-gray-200 bg-black"
                        src={asset.videoUrl}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
