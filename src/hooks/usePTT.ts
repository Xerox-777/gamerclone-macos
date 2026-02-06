import { useCallback, useEffect, useState } from "react";
import {
  getPTTKey,
  setPTTKey,
  onPTTStarted,
  onPTTStopped,
  onPipelineStage,
  onPipelineError,
  saveSetting,
  getAllSettings,
  startRecording,
  processVoiceQuery,
} from "../lib/tauri";
import { useAppStore } from "../stores/appStore";

export function usePTT() {
  const [isRebinding, setIsRebinding] = useState(false);

  const {
    pttKey,
    isListening,
    activeGameId,
    setPttKey,
    setIsListening,
    setStatus,
    addLogEntry,
  } = useAppStore();

  const handleSetPTTKey = useCallback(
    async (key: string) => {
      try {
        await setPTTKey(key);
        const displayKey = await getPTTKey();
        setPttKey(displayKey);
        await saveSetting("pttKey", key);
        addLogEntry("success", `PTT key set to: ${displayKey}`);
      } catch (e) {
        addLogEntry("error", `Failed to set PTT key: ${e}`);
      }
    },
    [setPttKey, addLogEntry]
  );

  const startRebinding = useCallback(() => setIsRebinding(true), []);
  const cancelRebinding = useCallback(() => setIsRebinding(false), []);

  // Load PTT key from backend on mount (sequential to avoid race condition)
  useEffect(() => {
    (async () => {
      try {
        // First restore saved binding (if any)
        const settings = await getAllSettings();
        const savedKey = settings.pttKey as string | undefined;
        if (savedKey) {
          await setPTTKey(savedKey);
        }
      } catch {
        // Settings not available, use backend default
      }
      // Then read current key for display
      try {
        const key = await getPTTKey();
        setPttKey(key);
      } catch {}
    })();
  }, [setPttKey]);

  // Subscribe to PTT + pipeline events
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let resetTimeout: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      unlisteners.push(
        await onPTTStarted(() => {
          setIsListening(true);
          setStatus("listening");
          addLogEntry("info", "Listening...");
          if (resetTimeout) clearTimeout(resetTimeout);
          startRecording().catch((e) => {
            addLogEntry("error", `Failed to start recording: ${e}`);
          });
        })
      );

      unlisteners.push(
        await onPTTStopped(() => {
          setIsListening(false);
          setStatus("processing");
          processVoiceQuery(activeGameId)
            .then((result) => {
              addLogEntry("success", `You: "${result.transcript}"`);
              addLogEntry("info", `Coach: "${result.response}" (${result.latencyMs}ms)`);
              setStatus("ready");
            })
            .catch((e) => {
              addLogEntry("error", `Pipeline error: ${e}`);
              setStatus("error");
              resetTimeout = setTimeout(() => setStatus("ready"), 3000);
            });
        })
      );

      unlisteners.push(
        await onPipelineStage((event) => {
          addLogEntry("info", event.message);
        })
      );

      unlisteners.push(
        await onPipelineError((event) => {
          addLogEntry("error", `[${event.stage}] ${event.message}`);
        })
      );
    })();

    return () => {
      unlisteners.forEach((fn) => fn());
      if (resetTimeout) clearTimeout(resetTimeout);
    };
  }, [setIsListening, setStatus, addLogEntry, activeGameId]);

  return {
    pttKey,
    isListening,
    isRebinding,
    handleSetPTTKey,
    startRebinding,
    cancelRebinding,
  };
}
