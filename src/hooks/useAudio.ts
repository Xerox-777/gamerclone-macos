import { useCallback, useEffect, useState } from "react";
import { listAudioDevices, setInputDevice, setOutputDevice, testMicrophone, getAllSettings, saveSetting } from "../lib/tauri";
import { useAppStore } from "../stores/appStore";
import type { AudioDeviceInfo } from "../types";

export function useAudio() {
  const [inputDevices, setInputDevices] = useState<AudioDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDeviceInfo[]>([]);
  const [loadingInputs, setLoadingInputs] = useState(false);
  const [loadingOutputs, setLoadingOutputs] = useState(false);
  const [testingMic, setTestingMic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    selectedInputDevice,
    selectedOutputDevice,
    setSelectedInputDevice,
    setSelectedOutputDevice,
    addLogEntry,
  } = useAppStore();

  const refreshInputDevices = useCallback(async () => {
    setLoadingInputs(true);
    try {
      const devices = await listAudioDevices("input");
      setInputDevices(devices);
    } catch (e) {
      setError(`Failed to list input devices: ${e}`);
    } finally {
      setLoadingInputs(false);
    }
  }, []);

  const refreshOutputDevices = useCallback(async () => {
    setLoadingOutputs(true);
    try {
      const devices = await listAudioDevices("output");
      setOutputDevices(devices);
    } catch (e) {
      setError(`Failed to list output devices: ${e}`);
    } finally {
      setLoadingOutputs(false);
    }
  }, []);

  const handleSelectInputDevice = useCallback(
    async (name: string) => {
      try {
        await setInputDevice(name);
        setSelectedInputDevice(name);
        await saveSetting("inputDevice", name);
        addLogEntry("success", `Input device: ${name}`);
      } catch (e) {
        const msg = `Failed to set input device: ${e}`;
        setError(msg);
        addLogEntry("error", msg);
      }
    },
    [setSelectedInputDevice, addLogEntry]
  );

  const handleSelectOutputDevice = useCallback(
    async (name: string) => {
      try {
        await setOutputDevice(name);
        setSelectedOutputDevice(name);
        await saveSetting("outputDevice", name);
        addLogEntry("success", `Output device: ${name}`);
      } catch (e) {
        const msg = `Failed to set output device: ${e}`;
        setError(msg);
        addLogEntry("error", msg);
      }
    },
    [setSelectedOutputDevice, addLogEntry]
  );

  const handleTestMicrophone = useCallback(async () => {
    setTestingMic(true);
    setError(null);
    try {
      const result = await testMicrophone();
      addLogEntry("success", result);
    } catch (e) {
      const msg = `Mic test failed: ${e}`;
      setError(msg);
      addLogEntry("error", msg);
    } finally {
      setTestingMic(false);
    }
  }, [addLogEntry]);

  // Load device lists and restore saved selections on mount
  useEffect(() => {
    refreshInputDevices();
    refreshOutputDevices();

    getAllSettings().then((settings) => {
      const savedInput = settings.inputDevice as string | undefined;
      const savedOutput = settings.outputDevice as string | undefined;
      if (savedInput) setSelectedInputDevice(savedInput);
      if (savedOutput) setSelectedOutputDevice(savedOutput);
    }).catch(() => {
      // Settings not available yet, use defaults
    });
  }, [refreshInputDevices, refreshOutputDevices, setSelectedInputDevice, setSelectedOutputDevice]);

  return {
    inputDevices,
    outputDevices,
    loadingInputs,
    loadingOutputs,
    testingMic,
    error,
    selectedInputDevice,
    selectedOutputDevice,
    refreshInputDevices,
    refreshOutputDevices,
    handleSelectInputDevice,
    handleSelectOutputDevice,
    handleTestMicrophone,
  };
}
