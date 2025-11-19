import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Mic, Square, Loader2 } from 'lucide-react';

const RecordingScreen = ({ setActiveScreen }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [pcitCoding, setPcitCoding] = useState(null);
  const [competencyAnalysis, setCompetencyAnalysis] = useState(null);
  const [parentSpeaker, setParentSpeaker] = useState(null);
  const [error, setError] = useState(null);
  const [waveformBars, setWaveformBars] = useState(
    Array.from({ length: 40 }, () => 20)
  );

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const mimeTypeRef = useRef('audio/webm');

  const total = 300; // 5:00 in seconds
  const progress = (elapsed / total) * 100;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Update waveform visualization
  const updateWaveform = () => {
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
  };

  const startRecording = async () => {
    try {
      setError(null);
      setTranscript(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analyser for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

      mimeTypeRef.current = selectedMimeType || 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream,
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );

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
        }

        // Reset waveform
        setWaveformBars(Array.from({ length: 40 }, () => 20));

        // Process audio with the actual recorded MIME type
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        await transcribeAudio(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);

      // Start timer
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev >= total - 1) {
            stopRecording();
            return total;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone. Please grant permission and try again.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  };

  // ElevenLabs Scribe transcription - best for similar voices
  const sendToElevenLabs = async (audioBlob) => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model_id', 'scribe_v1');
    formData.append('diarize', 'true');
    formData.append('num_speakers', '2');
    formData.append('timestamps_granularity', 'word');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail?.message || `API error: ${response.status}`);
    }

    const result = await response.json();

    // Group words by speaker into utterances
    if (result.words && result.words.length > 0) {
      // Parse speaker_id string (e.g., "speaker_0") to number
      const parseSpeakerId = (speakerId) => {
        if (!speakerId) return 0;
        const match = speakerId.match(/speaker_(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const utterances = [];
      let currentUtterance = {
        speaker: parseSpeakerId(result.words[0].speaker_id),
        text: '',
        start: result.words[0].start,
        end: result.words[0].end
      };

      for (const word of result.words) {
        const speakerId = parseSpeakerId(word.speaker_id);

        if (speakerId === currentUtterance.speaker) {
          // Same speaker, append word
          currentUtterance.text += (currentUtterance.text ? ' ' : '') + word.text;
          currentUtterance.end = word.end;
        } else {
          // New speaker, save current utterance and start new one
          if (currentUtterance.text) {
            utterances.push(currentUtterance);
          }
          currentUtterance = {
            speaker: speakerId,
            text: word.text,
            start: word.start,
            end: word.end
          };
        }
      }

      // Add last utterance
      if (currentUtterance.text) {
        utterances.push(currentUtterance);
      }

      return utterances;
    } else if (result.text) {
      return [{
        speaker: 0,
        text: result.text,
        start: 0,
        end: 0
      }];
    }

    return null;
  };

  // AssemblyAI transcription with better speaker diarization
  const sendToAssemblyAI = async (audioBlob) => {
    const apiKey = import.meta.env.VITE_ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    // Step 1: Upload audio
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: audioBlob
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const { upload_url } = await uploadResponse.json();

    // Step 2: Request transcription with speaker diarization
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        speakers_expected: 2
      })
    });

    if (!transcriptResponse.ok) {
      throw new Error(`Transcription request failed: ${transcriptResponse.status}`);
    }

    const { id } = await transcriptResponse.json();

    // Step 3: Poll for completion
    let result;
    while (true) {
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { 'Authorization': apiKey }
      });

      result = await pollResponse.json();

      if (result.status === 'completed') {
        break;
      } else if (result.status === 'error') {
        throw new Error(result.error || 'Transcription failed');
      }

      // Wait 1 second before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 4: Format utterances
    if (result.utterances && result.utterances.length > 0) {
      return result.utterances.map(utterance => ({
        speaker: utterance.speaker.charCodeAt(0) - 65, // Convert 'A', 'B', 'C' to 0, 1, 2
        text: utterance.text,
        start: utterance.start,
        end: utterance.end
      }));
    } else if (result.text) {
      return [{
        speaker: 0,
        text: result.text,
        start: 0,
        end: 0
      }];
    }

    return null;
  };

  // Deepgram transcription (fallback)
  const sendToDeepgram = async (audioBlob) => {
    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;

    if (!apiKey) {
      throw new Error('Deepgram API key not configured');
    }

    const arrayBuffer = await audioBlob.arrayBuffer();

    const contentTypeMap = {
      'audio/webm;codecs=opus': 'audio/webm',
      'audio/webm': 'audio/webm',
      'audio/ogg;codecs=opus': 'audio/ogg',
      'audio/mp4': 'audio/mp4',
      'audio/mpeg': 'audio/mpeg'
    };

    const contentType = contentTypeMap[audioBlob.type] || 'audio/webm';

    const response = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true&utterances=true&multichannel=false',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': contentType
        },
        body: arrayBuffer
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.err_msg || `API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.results?.utterances) {
      return result.results.utterances.map(utterance => ({
        speaker: utterance.speaker,
        text: utterance.transcript,
        start: utterance.start,
        end: utterance.end
      }));
    } else if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      return [{
        speaker: 0,
        text: result.results.channels[0].alternatives[0].transcript,
        start: 0,
        end: 0
      }];
    }

    return null;
  };

  // Combined speaker identification and PCIT coding via backend proxy
  const analyzeAndCode = async (transcriptData) => {
    try {
      const response = await fetch('http://localhost:3001/api/speaker-and-coding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: transcriptData
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        parentSpeaker: result.parentSpeaker,
        coding: result.coding,
        fullResponse: result.fullResponse
      };

    } catch (err) {
      console.error('Analysis and coding error:', err);
      return null;
    }
  };

  // Get competency analysis from Claude
  const getCompetencyAnalysis = async (counts) => {
    try {
      const response = await fetch('http://localhost:3001/api/competency-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ counts })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result = await response.json();
      return result.analysis;

    } catch (err) {
      console.error('Competency analysis error:', err);
      return null;
    }
  };

  // Main transcription function - tries ElevenLabs first, then Deepgram, then AssemblyAI
  const transcribeAudio = async (audioBlob) => {
    setIsProcessing(true);
    setError(null);

    try {
      let formattedTranscript = null;

      // Try ElevenLabs first (best for similar voices)
      const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
      if (elevenLabsKey) {
        try {
          console.log('Trying ElevenLabs Scribe...');
          formattedTranscript = await sendToElevenLabs(audioBlob);
        } catch (elevenLabsErr) {
          console.error('ElevenLabs failed:', elevenLabsErr);
          // Fall through to Deepgram
        }
      }

      // Fallback to Deepgram
      if (!formattedTranscript) {
        const deepgramKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
        if (deepgramKey) {
          try {
            console.log('Trying Deepgram...');
            formattedTranscript = await sendToDeepgram(audioBlob);
          } catch (deepgramErr) {
            console.error('Deepgram failed:', deepgramErr);
            // Fall through to AssemblyAI
          }
        }
      }

      // Fallback to AssemblyAI
      if (!formattedTranscript) {
        const assemblyKey = import.meta.env.VITE_ASSEMBLYAI_API_KEY;
        if (assemblyKey) {
          console.log('Trying AssemblyAI...');
          formattedTranscript = await sendToAssemblyAI(audioBlob);
        }
      }

      if (formattedTranscript && formattedTranscript.length > 0) {
        setTranscript(formattedTranscript);

        // Combined speaker identification and PCIT coding (single API call)
        console.log('Analyzing and coding transcript with Claude...');
        const result = await analyzeAndCode(formattedTranscript);
        if (result) {
          setAnalysis(result.fullResponse);

          if (result.parentSpeaker !== null) {
            setParentSpeaker(result.parentSpeaker);
          }

          if (result.coding) {
            setPcitCoding(result.coding);

            // Calculate tag counts for competency analysis
            const counts = {
              praise: (result.coding.match(/\[DO:\s*Praise\]/gi) || []).length,
              reflect: (result.coding.match(/\[DO:\s*Reflect\]/gi) || []).length,
              describe: (result.coding.match(/\[DO:\s*Describe\]/gi) || []).length,
              imitate: (result.coding.match(/\[DO:\s*Imitate\]/gi) || []).length,
              question: (result.coding.match(/\[DON'T:\s*Question\]/gi) || []).length,
              command: (result.coding.match(/\[DON'T:\s*Command\]/gi) || []).length,
              criticism: (result.coding.match(/\[DON'T:\s*Criticism\]/gi) || []).length,
              neutral: (result.coding.match(/\[Neutral\]/gi) || []).length
            };

            // Get competency analysis
            console.log('Getting competency analysis...');
            const competencyResult = await getCompetencyAnalysis(counts);
            if (competencyResult) {
              setCompetencyAnalysis(competencyResult);
            }
          }
        }
      } else {
        setError('No speech detected in the recording.');
      }

    } catch (err) {
      console.error('Transcription error:', err);
      setError(err.message || 'Failed to transcribe audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getSpeakerColor = (speaker) => {
    const colors = [
      'bg-blue-100 border-blue-300',
      'bg-green-100 border-green-300',
      'bg-purple-100 border-purple-300',
      'bg-orange-100 border-orange-300'
    ];
    return colors[speaker % colors.length];
  };

  const getSpeakerName = (speaker) => {
    // If we've identified the parent, use Parent/Child labels
    if (parentSpeaker !== null) {
      return speaker === parentSpeaker ? 'Parent' : 'Child';
    }
    // Default to Speaker 0, Speaker 1, etc.
    const names = ['Speaker 0', 'Speaker 1', 'Speaker 2', 'Speaker 3'];
    return names[speaker % names.length];
  };

  // Count PCIT tags from coding result
  const countPcitTags = (codingText) => {
    if (!codingText) return null;

    const counts = {
      describe: (codingText.match(/\[DO:\s*Describe\]/gi) || []).length,
      reflect: (codingText.match(/\[DO:\s*Reflect\]/gi) || []).length,
      praise: (codingText.match(/\[DO:\s*Praise\]/gi) || []).length,
      imitate: (codingText.match(/\[DO:\s*Imitate\]/gi) || []).length,
      question: (codingText.match(/\[DON'T:\s*Question\]/gi) || []).length,
      command: (codingText.match(/\[DON'T:\s*Command\]/gi) || []).length,
      criticism: (codingText.match(/\[DON'T:\s*Criticism\]/gi) || []).length,
      neutral: (codingText.match(/\[Neutral\]/gi) || []).length
    };

    counts.totalPride = counts.describe + counts.reflect + counts.praise + counts.imitate;
    counts.totalAvoid = counts.question + counts.command + counts.criticism;

    return counts;
  };

  const tagCounts = countPcitTags(pcitCoding);

  return (
    <div className="min-h-screen bg-white pb-24 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12">
        <button
          onClick={() => setActiveScreen('learn')}
          className="p-2 -ml-2"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
      </div>

      {/* Timer */}
      <div className="px-6 mt-4">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(total)}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Main Content Area */}
      {!transcript && !isProcessing ? (
        <>
          {/* Caterpillar Mascot */}
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="relative">
              <div className="flex items-end">
                <div className="flex">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="w-12 h-12 bg-green-400 rounded-full -ml-3 first:ml-0"
                      style={{
                        backgroundColor: i === 0 ? '#4ade80' : '#86efac',
                        zIndex: 4 - i
                      }}
                    ></div>
                  ))}
                </div>
                <div className="w-16 h-16 bg-green-500 rounded-full -ml-4 relative z-10">
                  <div className="absolute top-4 left-3 w-2 h-2 bg-gray-800 rounded-full"></div>
                  <div className="absolute top-4 right-3 w-2 h-2 bg-gray-800 rounded-full"></div>
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-4 h-2 border-b-2 border-gray-800 rounded-b-full"></div>
                  <div className="absolute -top-3 left-4 w-1 h-4 bg-green-600 rounded-full transform -rotate-12"></div>
                  <div className="absolute -top-3 right-4 w-1 h-4 bg-green-600 rounded-full transform rotate-12"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Audio Visualizer */}
          <div className="px-6 mb-6">
            <div className="bg-gray-100 rounded-2xl p-4">
              <div className="flex items-end justify-center h-16 gap-1">
                {waveformBars.map((height, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-100 ${
                      isRecording ? 'bg-red-400' : 'bg-blue-400'
                    }`}
                    style={{ height: `${height}%` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 mb-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          <div className="flex justify-center mb-8">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"
              >
                <Mic size={32} className="text-white" />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors animate-pulse"
              >
                <Square size={28} className="text-white" />
              </button>
            )}
          </div>

          <p className="text-center text-gray-500 text-sm mb-4">
            {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
          </p>
        </>
      ) : isProcessing ? (
        /* Processing State */
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <Loader2 size={48} className="text-green-500 animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Transcribing audio...</p>
          <p className="text-gray-400 text-sm mt-2">Identifying speakers</p>
        </div>
      ) : (
        /* Transcript Display */
        <div className="flex-1 px-6 mt-4 overflow-y-auto">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Conversation Transcript</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-3 mb-6">
            {transcript && transcript.map((utterance, index) => (
              <div
                key={index}
                className={`p-3 rounded-xl border ${getSpeakerColor(utterance.speaker)}`}
              >
                <p className="text-xs font-semibold text-gray-600 mb-1">
                  {getSpeakerName(utterance.speaker)}
                </p>
                <p className="text-gray-800 text-sm">{utterance.text}</p>
              </div>
            ))}
          </div>

          {/* PCIT Analysis */}
          {analysis && (
            <div className="mb-6">
              <h3 className="text-md font-bold text-gray-800 mb-3">Speaker Identification</h3>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{analysis}</p>
              </div>
            </div>
          )}

          {/* PCIT Tag Counts */}
          {tagCounts && (
            <div className="mb-6">
              <h3 className="text-md font-bold text-gray-800 mb-3">PCIT Summary</h3>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                {/* Pride Skills (DOs) */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-green-600 mb-2">Pride Skills (DO)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Labeled Praise</span>
                      <span className="font-medium">{tagCounts.praise}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reflection</span>
                      <span className="font-medium">{tagCounts.reflect}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Imitation</span>
                      <span className="font-medium">{tagCounts.imitate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Description</span>
                      <span className="font-medium">{tagCounts.describe}</span>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
                    <span className="font-semibold text-green-600">Total "Pride" Skills</span>
                    <span className="font-bold text-green-600">{tagCounts.totalPride}</span>
                  </div>
                </div>

                {/* Avoid Skills (DON'Ts) */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-red-600 mb-2">Avoid Skills (DON'T)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Question</span>
                      <span className="font-medium">{tagCounts.question}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Command</span>
                      <span className="font-medium">{tagCounts.command}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Criticism</span>
                      <span className="font-medium">{tagCounts.criticism}</span>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
                    <span className="font-semibold text-red-600">Total "Avoid" Skills</span>
                    <span className="font-bold text-red-600">{tagCounts.totalAvoid}</span>
                  </div>
                </div>

                {/* Neutral */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Neutral Talk</span>
                  <span className="font-medium">{tagCounts.neutral}</span>
                </div>
              </div>
            </div>
          )}

          {/* Competency Analysis */}
          {competencyAnalysis && (
            <div className="mb-6">
              <h3 className="text-md font-bold text-gray-800 mb-3">Competency Analysis & Recommendations</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{competencyAnalysis}</p>
              </div>
            </div>
          )}

          {/* PCIT Coding */}
          {pcitCoding && (
            <div className="mb-6">
              <h3 className="text-md font-bold text-gray-800 mb-3">PCIT Coding Details</h3>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{pcitCoding}</p>
              </div>
            </div>
          )}

          {/* New Recording Button */}
          <div className="flex justify-center mb-8">
            <button
              onClick={() => {
                setTranscript(null);
                setAnalysis(null);
                setPcitCoding(null);
                setCompetencyAnalysis(null);
                setParentSpeaker(null);
                setElapsed(0);
                setError(null);
              }}
              className="bg-green-500 text-white px-6 py-3 rounded-full font-medium hover:bg-green-600 transition-colors"
            >
              New Recording
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordingScreen;
