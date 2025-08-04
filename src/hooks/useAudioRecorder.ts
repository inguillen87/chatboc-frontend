// src/hooks/useAudioRecorder.ts
import { useState, useRef, useCallback } from 'react';

type AudioRecorderState = 'inactive' | 'recording' | 'paused';

interface UseAudioRecorderReturn {
  recorderState: AudioRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  isRecording: boolean;
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [recorderState, setRecorderState] = useState<AudioRecorderState>('inactive');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async (): Promise<void> => {
    if (recorderState !== 'inactive') {
      console.warn('Recording is already active.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setRecorderState('recording');
      };

      // The 'stop' event is handled in the stopRecording function to return the Blob.
      recorder.start();
    } catch (error) {
      console.error('Error starting audio recording:', error);
      setRecorderState('inactive');
      // Re-throw to allow UI components to catch the error and show a toast
      throw error;
    }
  }, [recorderState]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorderState !== 'recording') {
        console.warn('No active recording to stop.');
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Stop all media tracks to turn off the microphone indicator in the browser
        recorder.stream.getTracks().forEach(track => track.stop());

        // Reset state
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setRecorderState('inactive');

        resolve(audioBlob);
      };

      recorder.stop();
    });
  }, [recorderState]);

  return {
    recorderState,
    startRecording,
    stopRecording,
    isRecording: recorderState === 'recording',
  };
};

export default useAudioRecorder;
