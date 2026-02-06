import { useCallback, useEffect, useRef, useState } from "react";
import { listWindows, selectWindow, stopCapture, getCaptureStatus } from "../lib/tauri";
import { useAppStore } from "../stores/appStore";
import type { WindowInfo } from "../types";

export function useCapture() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    selectedWindow,
    isCapturing,
    captureFrameCount,
    setSelectedWindow,
    setIsCapturing,
    setCaptureFrameCount,
    addLogEntry,
  } = useAppStore();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshWindows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listWindows();
      setWindows(result);
    } catch (e) {
      const msg = `Failed to list windows: ${e}`;
      setError(msg);
      addLogEntry("error", msg);
    } finally {
      setLoading(false);
    }
  }, [addLogEntry]);

  const handleSelectWindow = useCallback(
    async (window: WindowInfo) => {
      try {
        await selectWindow(window.hwnd);
        setSelectedWindow(window);
        setIsCapturing(true);
        addLogEntry("success", `Capturing: ${window.title}`);
      } catch (e) {
        const msg = `Failed to start capture: ${e}`;
        addLogEntry("error", msg);
        setError(msg);
      }
    },
    [setSelectedWindow, setIsCapturing, addLogEntry]
  );

  const handleStopCapture = useCallback(async () => {
    try {
      await stopCapture();
      setIsCapturing(false);
      setCaptureFrameCount(0);
      setSelectedWindow(null);
      addLogEntry("info", "Capture stopped");
    } catch (e) {
      addLogEntry("error", `Failed to stop capture: ${e}`);
    }
  }, [setIsCapturing, setCaptureFrameCount, setSelectedWindow, addLogEntry]);

  // Poll capture status while capturing
  useEffect(() => {
    if (isCapturing) {
      pollRef.current = setInterval(async () => {
        try {
          const status = await getCaptureStatus();
          setCaptureFrameCount(status.frameCount);
          if (!status.isCapturing) {
            // Capture stopped unexpectedly
            setIsCapturing(false);
            setCaptureFrameCount(0);
            setSelectedWindow(null);
            addLogEntry("warning", "Capture stopped unexpectedly");
          }
        } catch {
          // Ignore poll errors
        }
      }, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isCapturing, setCaptureFrameCount, setIsCapturing, setSelectedWindow, addLogEntry]);

  // Refresh window list on mount
  useEffect(() => {
    refreshWindows();
  }, [refreshWindows]);

  return {
    windows,
    loading,
    error,
    selectedWindow,
    isCapturing,
    captureFrameCount,
    refreshWindows,
    handleSelectWindow,
    handleStopCapture,
  };
}
