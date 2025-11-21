import React, { useState } from 'react';
import { ArrowLeft, Mic, Square, Loader2, Mail, Check, Award, Save } from 'lucide-react';
import useAudioRecorder from '../hooks/useAudioRecorder';
import useTranscription from '../hooks/useTranscription';
import usePCITAnalysis from '../hooks/usePCITAnalysis';
import sessionService from '../services/sessionService';

const RecordingScreen = ({ setActiveScreen }) => {
  const [mode, setMode] = useState('CDI'); // 'CDI' or 'PDI'
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [pcitCoding, setPcitCoding] = useState(null);
  const [competencyAnalysis, setCompetencyAnalysis] = useState(null);
  const [parentSpeaker, setParentSpeaker] = useState(null);
  const [flaggedItems, setFlaggedItems] = useState([]);
  const [processingError, setProcessingError] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cdiMastery, setCdiMastery] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);

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
  const {
    // CDI functions
    analyzeAndCode,
    getCompetencyAnalysis,
    countPcitTags,
    extractNegativePhraseFlags,
    checkCdiMastery,
    // PDI functions
    pdiAnalyzeAndCode,
    getPdiCompetencyAnalysis,
    countPdiTags,
    // Shared
    sendCoachAlert
  } = usePCITAnalysis();

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
    setFlaggedItems([]);
    setProcessingError(null);
    setEmailSending(false);
    setEmailSent(false);
    setCdiMastery(null);
    startRecording(handleAudioReady);
  };

  const handleAudioReady = async (audioBlob) => {
    setIsProcessing(true);
    setProcessingError(null);
    setSessionSaved(false);

    // Store audio blob and duration for saving
    setAudioBlob(audioBlob);
    setSessionDuration(elapsed);

    try {
      // Transcribe audio
      const formattedTranscript = await transcribe(audioBlob);

      if (formattedTranscript && formattedTranscript.length > 0) {
        setTranscript(formattedTranscript);

        if (mode === 'CDI') {
          // CDI Mode: PRIDE skills analysis
          console.log('Analyzing CDI transcript with Claude...');
          const result = await analyzeAndCode(formattedTranscript);

          if (result) {
            setAnalysis(result.fullResponse);

            if (result.parentSpeaker !== null) {
              setParentSpeaker(result.parentSpeaker);
            }

            if (result.coding) {
              setPcitCoding(result.coding);

              // Extract flagged negative phrases for human review
              const flags = extractNegativePhraseFlags(result.coding, formattedTranscript);
              if (flags.length > 0) {
                setFlaggedItems(flags);
                console.warn(`Found ${flags.length} negative phrase(s) requiring review`);
              }

              // Calculate tag counts for competency analysis
              const counts = countPcitTags(result.coding);

              // Check CDI mastery
              const mastery = checkCdiMastery(counts);
              setCdiMastery(mastery);

              // Get competency analysis
              console.log('Getting CDI competency analysis...');
              const competencyResult = await getCompetencyAnalysis(counts);
              if (competencyResult) {
                setCompetencyAnalysis(competencyResult);
              }
            }
          }
        } else {
          // PDI Mode: Command quality analysis
          console.log('Analyzing PDI transcript with Claude...');
          const result = await pdiAnalyzeAndCode(formattedTranscript);

          if (result) {
            setAnalysis(result.fullResponse);

            if (result.parentSpeaker !== null) {
              setParentSpeaker(result.parentSpeaker);
            }

            if (result.coding) {
              setPcitCoding(result.coding);

              // Calculate PDI tag counts
              const counts = countPdiTags(result.coding);

              // Get PDI competency analysis
              console.log('Getting PDI competency analysis...');
              const competencyResult = await getPdiCompetencyAnalysis(counts);
              if (competencyResult) {
                setCompetencyAnalysis(competencyResult);
              }
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
    setFlaggedItems([]);
    setProcessingError(null);
    setEmailSending(false);
    setEmailSent(false);
    setCdiMastery(null);
    setAudioBlob(null);
    setSessionDuration(0);
    setIsSaving(false);
    setSessionSaved(false);
    resetRecorder();
  };

  const handleSaveSession = async () => {
    if (!pcitCoding || !transcript || !audioBlob) {
      setProcessingError('Cannot save: missing session data');
      return;
    }

    setIsSaving(true);
    setProcessingError(null);

    try {
      // Prepare tag counts based on mode
      const tagCounts = mode === 'CDI'
        ? countPcitTags(pcitCoding)
        : countPdiTags(pcitCoding);

      const sessionData = {
        audioBlob,
        mode,
        transcript: typeof transcript === 'string' ? transcript : JSON.stringify(transcript),
        pcitCoding,
        tagCounts,
        durationSeconds: sessionDuration,
        aiFeedback: {
          analysis,
          competencyAnalysis,
          parentSpeaker,
          flaggedItems,
          ...(mode === 'CDI' && { cdiMastery })
        }
      };

      const result = await sessionService.uploadSession(sessionData);
      console.log('Session saved:', result);
      setSessionSaved(true);

      // Auto-redirect to progress screen after 2 seconds
      setTimeout(() => {
        setActiveScreen('progress');
      }, 2000);
    } catch (err) {
      console.error('Failed to save session:', err);
      setProcessingError(err.message || 'Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendCoachAlert = async () => {
    if (flaggedItems.length === 0) return;

    setEmailSending(true);
    try {
      await sendCoachAlert(flaggedItems, {
        date: new Date().toLocaleDateString()
      });
      setEmailSent(true);
    } catch (err) {
      console.error('Failed to send coach alert:', err);
      setProcessingError(err.message || 'Failed to send email to coach');
    } finally {
      setEmailSending(false);
    }
  };

  const formatTimestamp = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  const tagCounts = mode === 'CDI' ? countPcitTags(pcitCoding) : countPdiTags(pcitCoding);

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

          {/* Mode Selector */}
          {!isRecording && (
            <div className="px-6 mb-4">
              <div className="bg-gray-100 rounded-xl p-3">
                <p className="text-xs text-gray-500 text-center mb-2">Session Mode</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode('CDI')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      mode === 'CDI'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    CDI
                    <span className="block text-xs font-normal opacity-80">Relationship</span>
                  </button>
                  <button
                    onClick={() => setMode('PDI')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      mode === 'PDI'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    PDI
                    <span className="block text-xs font-normal opacity-80">Discipline</span>
                  </button>
                </div>
              </div>
            </div>
          )}

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

          {/* CDI Mastery Congratulations */}
          {mode === 'CDI' && cdiMastery && cdiMastery.mastered && (
            <div className="mb-6">
              <div className="bg-gradient-to-r from-yellow-50 to-green-50 border-2 border-yellow-400 rounded-xl p-4">
                <div className="flex items-center mb-3">
                  <Award size={24} className="text-yellow-500 mr-2" />
                  <h3 className="text-lg font-bold text-green-700">CDI Mastery Achieved!</h3>
                </div>
                <p className="text-gray-700 text-sm mb-3">
                  Congratulations! You have met all CDI criteria and are ready to move on to
                  Parent-Directed Interaction (PDI) training.
                </p>
                <div className="bg-white rounded-lg p-3 text-sm">
                  <p className="font-medium text-gray-700 mb-2">Criteria Met:</p>
                  <ul className="space-y-1 text-gray-600">
                    <li className="flex items-center">
                      <Check size={14} className="text-green-500 mr-2" />
                      Labeled Praise: {tagCounts?.praise} (target: 10+)
                    </li>
                    <li className="flex items-center">
                      <Check size={14} className="text-green-500 mr-2" />
                      Reflection: {tagCounts?.reflect} (target: 10+)
                    </li>
                    <li className="flex items-center">
                      <Check size={14} className="text-green-500 mr-2" />
                      Description: {tagCounts?.describe} (target: 10+)
                    </li>
                    <li className="flex items-center">
                      <Check size={14} className="text-green-500 mr-2" />
                      Total Avoid Skills: {tagCounts?.totalAvoid} (target: 3 or less)
                    </li>
                    <li className="flex items-center">
                      <Check size={14} className="text-green-500 mr-2" />
                      Negative Phrases: {tagCounts?.negative_phrases} (target: 0)
                    </li>
                  </ul>
                </div>
                <p className="text-sm text-green-600 mt-3 font-medium">
                  Select PDI mode for your next session to begin discipline training.
                </p>
              </div>
            </div>
          )}

          {/* Flagged Items for Human Coach Review */}
          {flaggedItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-bold text-red-700 mb-3 flex items-center">
                <span className="mr-2">⚠️</span>
                Flagged for Human Coach Review
              </h3>
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                <p className="text-red-700 text-sm font-medium mb-3">
                  The following utterances contain negative phrases and require immediate review:
                </p>
                <div className="space-y-3">
                  {flaggedItems.map((item, index) => (
                    <div key={index} className="bg-white border border-red-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded">
                          Timestamp: {formatTimestamp(item.timestamp)}
                        </span>
                        {item.speaker !== null && (
                          <span className="text-xs text-gray-500">
                            Speaker {item.speaker}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 text-sm font-medium">"{item.text}"</p>
                      <p className="text-red-600 text-xs mt-2 italic">{item.reason}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleSendCoachAlert}
                    disabled={emailSending || emailSent}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      emailSent
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : emailSending
                        ? 'bg-gray-100 text-gray-500 cursor-wait'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {emailSent ? (
                      <>
                        <Check size={16} className="mr-2" />
                        Alert Sent to Coach
                      </>
                    ) : emailSending ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail size={16} className="mr-2" />
                        Send Alert to Coach
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

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
              <h3 className="text-md font-bold text-gray-800 mb-3">
                {mode === 'CDI' ? 'CDI Summary' : 'PDI Summary'}
              </h3>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                {mode === 'CDI' ? (
                  <>
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
                        <div className="flex justify-between">
                          <span className="text-gray-600">Negative Phrases</span>
                          <span className="font-medium">{tagCounts.negative_phrases}</span>
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
                  </>
                ) : (
                  <>
                    {/* Effective Commands Percentage */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Effective Commands</span>
                        <span className={`text-2xl font-bold ${
                          tagCounts.effectivePercent >= 75 ? 'text-green-600' : 'text-orange-500'
                        }`}>
                          {tagCounts.effectivePercent}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Target: 75% or higher</p>
                    </div>

                    {/* Effective Commands (DOs) */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-green-600 mb-2">Effective Commands (DO)</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Direct Command</span>
                          <span className="font-medium">{tagCounts.direct_command}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Positive Command</span>
                          <span className="font-medium">{tagCounts.positive_command}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Specific Command</span>
                          <span className="font-medium">{tagCounts.specific_command}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Labeled Praise</span>
                          <span className="font-medium">{tagCounts.labeled_praise}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Correct Warning</span>
                          <span className="font-medium">{tagCounts.correct_warning}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Correct Time-Out</span>
                          <span className="font-medium">{tagCounts.correct_timeout}</span>
                        </div>
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
                        <span className="font-semibold text-green-600">Total Effective</span>
                        <span className="font-bold text-green-600">{tagCounts.totalEffective}</span>
                      </div>
                    </div>

                    {/* Ineffective Commands (DON'Ts) */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-red-600 mb-2">Ineffective Commands (DON'T)</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Indirect Command</span>
                          <span className="font-medium">{tagCounts.indirect_command}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Negative Command</span>
                          <span className="font-medium">{tagCounts.negative_command}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Vague Command</span>
                          <span className="font-medium">{tagCounts.vague_command}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Chained Command</span>
                          <span className="font-medium">{tagCounts.chained_command}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Harsh Tone</span>
                          <span className="font-medium">{tagCounts.harsh_tone}</span>
                        </div>
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
                        <span className="font-semibold text-red-600">Total Ineffective</span>
                        <span className="font-bold text-red-600">{tagCounts.totalIneffective}</span>
                      </div>
                    </div>

                    {/* Neutral */}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Neutral Talk</span>
                      <span className="font-medium">{tagCounts.neutral}</span>
                    </div>
                  </>
                )}
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

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center mb-8">
            {!sessionSaved && (
              <button
                onClick={handleSaveSession}
                disabled={isSaving}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-colors ${
                  isSaving
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Session
                  </>
                )}
              </button>
            )}

            {sessionSaved && (
              <div className="flex items-center gap-2 px-6 py-3 rounded-full font-medium bg-green-100 text-green-700 border border-green-300">
                <Check className="w-5 h-5" />
                Session Saved!
              </div>
            )}

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
