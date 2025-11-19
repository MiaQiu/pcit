import React, { useState } from 'react';
import { ArrowLeft, Mic, Square, Loader2 } from 'lucide-react';
import useAudioRecorder from '../hooks/useAudioRecorder';
import useTranscription from '../hooks/useTranscription';
import usePCITAnalysis from '../hooks/usePCITAnalysis';

const RecordingScreen = ({ setActiveScreen }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [pcitCoding, setPcitCoding] = useState(null);
  const [competencyAnalysis, setCompetencyAnalysis] = useState(null);
  const [parentSpeaker, setParentSpeaker] = useState(null);
  const [processingError, setProcessingError] = useState(null);

  const {
    isRecording,
    elapsed,
    progress,
    waveformBars,
    error: recorderError,
    startRecording,
    stopRecording,
    reset: resetRecorder,
    maxDuration
  } = useAudioRecorder(300);

  const { transcribe } = useTranscription();
  const { analyzeAndCode, getCompetencyAnalysis, countPcitTags } = usePCITAnalysis();

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = () => {
    setTranscript(null);
    setAnalysis(null);
    setPcitCoding(null);
    setCompetencyAnalysis(null);
    setParentSpeaker(null);
    setProcessingError(null);
    startRecording(handleAudioReady);
  };

  const handleAudioReady = async (audioBlob) => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      // Transcribe audio
      const formattedTranscript = await transcribe(audioBlob);

      if (formattedTranscript && formattedTranscript.length > 0) {
        setTranscript(formattedTranscript);

        // Combined speaker identification and PCIT coding
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
            const counts = countPcitTags(result.coding);

            // Get competency analysis
            console.log('Getting competency analysis...');
            const competencyResult = await getCompetencyAnalysis(counts);
            if (competencyResult) {
              setCompetencyAnalysis(competencyResult);
            }
          }
        }
      } else {
        setProcessingError('No speech detected in the recording.');
      }
    } catch (err) {
      console.error('Processing error:', err);
      setProcessingError(err.message || 'Failed to process audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewRecording = () => {
    setTranscript(null);
    setAnalysis(null);
    setPcitCoding(null);
    setCompetencyAnalysis(null);
    setParentSpeaker(null);
    setProcessingError(null);
    resetRecorder();
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
    if (parentSpeaker !== null) {
      return speaker === parentSpeaker ? 'Parent' : 'Child';
    }
    const names = ['Speaker 0', 'Speaker 1', 'Speaker 2', 'Speaker 3'];
    return names[speaker % names.length];
  };

  const error = recorderError || processingError;
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
          <span>{formatTime(maxDuration)}</span>
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
                onClick={handleStartRecording}
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
            {transcript && transcript.map((utterance, index) => {
              // Validate utterance has required properties
              if (!utterance || typeof utterance.speaker !== 'number' || !utterance.text) {
                return (
                  <div key={index} className="p-3 rounded-xl border bg-gray-100 border-gray-300">
                    <p className="text-gray-500 text-sm italic">Invalid utterance data</p>
                  </div>
                );
              }
              return (
                <div
                  key={index}
                  className={`p-3 rounded-xl border ${getSpeakerColor(utterance.speaker)}`}
                >
                  <p className="text-xs font-semibold text-gray-600 mb-1">
                    {getSpeakerName(utterance.speaker)}
                  </p>
                  <p className="text-gray-800 text-sm">{utterance.text}</p>
                </div>
              );
            })}
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
              onClick={handleNewRecording}
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
