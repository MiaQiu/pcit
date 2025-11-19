import { useState, useRef, useEffect, useCallback } from 'react';

const useAudioRecorder = (maxDuration = 300) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [waveformBars, setWaveformBars] = useState(
    Array.from({ length: 40 }, () => 20)
  );
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationRef = useRef(null);
  const mimeTypeRef = useRef('audio/webm');
  const onStopCallbackRef = useRef(null);
  const isStoppingRef = useRef(false); // Guard against multiple stops

  const progress = (elapsed / maxDuration) * 100;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Cancel animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      // Close audio context to prevent memory leak
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      // Clear callback ref
      onStopCallbackRef.current = null;
    };
  }, []);

  // Update waveform visualization
  const updateWaveform = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      const bars = [];
      const step = Math.floor(dataArray.length / 40);
      for (let i = 0; i < 40; i++) {
        const value = dataArray[i * step];
        bars.push(Math.max(20, (value / 255) * 100));
      }
      setWaveformBars(bars);
    }
    animationRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = useCallback(async (onStop) => {
    // Guard against starting while already recording
    if (isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      setError(null);
      audioChunksRef.current = [];
      onStopCallbackRef.current = onStop;
      isStoppingRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Close previous audio context if exists
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }

      // Set up audio analyser for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start waveform animation
      updateWaveform();

      // Detect supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/mpeg'
      ];

      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported audio format found');
      }

      mimeTypeRef.current = selectedMimeType;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Stop animation
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }

        // Close audio context
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Reset waveform
        setWaveformBars(Array.from({ length: 40 }, () => 20));

        // Create audio blob and call callback
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });

        // Validate blob has content
        if (audioBlob.size === 0) {
          setError('No audio was recorded');
          return;
        }

        // Call callback and clear ref
        const callback = onStopCallbackRef.current;
        onStopCallbackRef.current = null;
        if (callback) {
          callback(audioBlob);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);

      // Start timer
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err.message || 'Could not access microphone. Please grant permission and try again.');
    }
  }, [isRecording, maxDuration, updateWaveform]);

  const stopRecording = useCallback(() => {
    // Guard against multiple stop calls
    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  }, []);

  const reset = useCallback(() => {
    setElapsed(0);
    setError(null);
    isStoppingRef.current = false;
  }, []);

  return {
    isRecording,
    elapsed,
    progress,
    waveformBars,
    error,
    startRecording,
    stopRecording,
    reset,
    maxDuration
  };
};

export default useAudioRecorder;
