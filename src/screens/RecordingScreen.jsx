import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Mic, Square, Loader2, Mail, Check, Award, Save, CheckCircle, TrendingUp, Target, ChevronDown, ChevronUp, Info } from 'lucide-react';
import useAudioRecorder from '../hooks/useAudioRecorder';
import useTranscription from '../hooks/useTranscription';
import usePCITAnalysis from '../hooks/usePCITAnalysis';
import sessionService from '../services/sessionService';
import dinoImage from '../assets/dino.png';

const RecordingScreen = ({ setActiveScreen, previewSessionId = null }) => {
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
  const [previewMode, setPreviewMode] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [previewEnabled, setPreviewEnabled] = useState(false);

  // Use ref for cancelling flag to ensure synchronous access in handleAudioReady
  const isCancellingRef = useRef(false);

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

  // Load preview session when preview mode is enabled
  useEffect(() => {
    if (previewEnabled) {
      const mockSessionId = '67264850-64fe-4ca2-b21d-3fbe84398d51';
      loadPreviewSession(mockSessionId);
    } else {
      // Reset to normal recording mode when preview is disabled
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
      setPreviewMode(false);
      setIsProcessing(false);
    }
  }, [previewEnabled]);

  const loadPreviewSession = async (sessionId) => {
    setIsProcessing(true);
    setPreviewMode(true);

    try {
      // DEVELOPMENT: Use mock data for session preview
      // In production, this would load from API: await sessionService.getSessionById(sessionId)

      const mockSessionData = {
        id: "67264850-64fe-4ca2-b21d-3fbe84398d51",
        mode: "CDI",
        durationSeconds: 35,
        transcript: [
          {"speaker":0,"text":"build. (blocks clattering) You're gonna build. I'm gonna build with you. (blocks clattering) We are building orange, brown, and red tower.","start":0.079,"end":13.079},
          {"speaker":1,"text":"Look, it's a s- this could be a slide.","start":13.079,"end":15.959},
          {"speaker":0,"text":"It could be a slide. That's a great idea.","start":15.959,"end":17.799},
          {"speaker":1,"text":"You could climb up here and then go like this, and then you could ride off. Whee.","start":17.799,"end":21.339},
          {"speaker":0,"text":"Whee.","start":21.339,"end":21.379},
          {"speaker":1,"text":"And this could be the pool.","start":21.379,"end":22.799},
          {"speaker":0,"text":"And that could be the pool. I love that idea. I'm gonna add to your pool. (blocks clattering)","start":22.799,"end":28.119},
          {"speaker":1,"text":"Yeah.","start":28.119,"end":28.119},
          {"speaker":0,"text":"I'm gonna make a blue, high tower.","start":28.119,"end":34.479}
        ],
        pcitCoding: `**Parent:** "build. (blocks clattering) You're gonna build. I'm gonna build with you. (blocks clattering) We are building orange, brown, and red tower." -> **[DO: Describe]**

**Parent:** "It could be a slide. That's a great idea." -> **[DO: Reflect]** and **[DO: Praise]**

**Parent:** "Whee." -> **[DO: Reflect]**

**Parent:** "And that could be the pool. I love that idea. I'm gonna add to your pool. (blocks clattering)" -> **[DO: Reflect]** and **[DO: Praise]** and **[Neutral]**

**Parent:** "I'm gonna make a blue, high tower." -> **[Neutral]**`,
        tagCounts: {
          praise: 2,
          command: 0,
          imitate: 0,
          neutral: 2,
          reflect: 3,
          describe: 1,
          question: 0,
          criticism: 0,
          totalAvoid: 0,
          totalPride: 6,
          negative_phrases: 0
        },
        aiFeedbackJSON: {
          analysis: "Based on the conversation, Speaker 0 demonstrates characteristics of a parent engaging in child-directed interaction:\n\n1. Provides descriptions of the activity\n2. Reflects the child's ideas\n3. Gives labeled praise\n4. Imitates the child's sounds and actions\n\nSpeaker 1 appears to be the child, showing:\n1. Creative play and imagination\n2. Initiating ideas\n3. Responding to parent's engagement\n\nTherefore, **Speaker 0 is the Parent** and **Speaker 1 is the Child**.",
          competencyAnalysis: "Great job using PRIDE skills during this play session! Here's your analysis:\n\n**Strengths:**\n✓ Excellent reflection skills - you mirrored your child's ideas 3 times\n✓ Good use of labeled praise - acknowledged creativity\n✓ Strong behavioral description - narrated your building activity\n✓ No commands, questions, or criticism - perfect CDI!\n\n**Areas for Growth:**\n• To achieve mastery, aim for 10+ of each DO skill in a 5-minute session\n• Current: Praise (2), Reflect (3), Describe (1)\n• Try to increase praise and description frequency\n\n**Next Steps:**\n• Practice giving more specific labeled praise (\"I like how you...\", \"You did a great job...\")\n• Describe more of what you and your child are doing\n• Keep avoiding commands and questions - you're doing this perfectly!",
          parentSpeaker: 0,
          flaggedItems: [],
          cdiMastery: {
            mastered: false,
            criteria: {
              praise: { current: 2, target: 10, met: false },
              reflect: { current: 3, target: 10, met: false },
              describe: { current: 1, target: 10, met: false },
              totalAvoid: { current: 0, target: 3, met: true },
              negative_phrases: { current: 0, target: 0, met: true }
            }
          }
        }
      };

      setMode(mockSessionData.mode);
      setTranscript(mockSessionData.transcript);
      setPcitCoding(mockSessionData.pcitCoding);

      if (mockSessionData.aiFeedbackJSON) {
        if (mockSessionData.aiFeedbackJSON.analysis) {
          setAnalysis(mockSessionData.aiFeedbackJSON.analysis);
        }
        if (mockSessionData.aiFeedbackJSON.competencyAnalysis) {
          setCompetencyAnalysis(mockSessionData.aiFeedbackJSON.competencyAnalysis);
        }
        if (mockSessionData.aiFeedbackJSON.parentSpeaker !== undefined) {
          setParentSpeaker(mockSessionData.aiFeedbackJSON.parentSpeaker);
        }
        if (mockSessionData.aiFeedbackJSON.flaggedItems) {
          setFlaggedItems(mockSessionData.aiFeedbackJSON.flaggedItems);
        }
        if (mockSessionData.aiFeedbackJSON.cdiMastery) {
          setCdiMastery(mockSessionData.aiFeedbackJSON.cdiMastery);
        }
      }

      setSessionDuration(mockSessionData.durationSeconds);
      setSessionSaved(true);

      console.log('Preview session loaded:', sessionId);
    } catch (err) {
      console.error('Failed to load preview session:', err);
      setProcessingError('Failed to load session for preview');
    } finally {
      setIsProcessing(false);
    }
  };
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
    // Skip processing if user cancelled the recording
    if (isCancellingRef.current) {
      console.log('Recording cancelled - discarding audio blob and skipping all processing');
      // Audio blob will be garbage collected, no file is saved
      isCancellingRef.current = false; // Reset for next recording
      return;
    }

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

  const handleCancelRecording = () => {
    console.log('Recording cancelled by user - discarding audio data');

    // Set cancelling flag to prevent audio processing (using ref for synchronous access)
    isCancellingRef.current = true;

    // Stop recording (will trigger audio cleanup but won't process)
    stopRecording();

    // Reset all state and discard any recorded audio
    setTimeout(() => {
      handleNewRecording();
      console.log('Recording screen reset - ready for new recording');
    }, 100);
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

  // Parse PCIT coding to extract tags for each utterance
  const parseTagsFromCoding = (pcitCoding, transcript) => {
    if (!pcitCoding || !transcript) return {};

    const utteranceTags = {};

    // Split coding by lines and parse each parent utterance
    const lines = pcitCoding.split('\n');

    lines.forEach(line => {
      // Look for pattern: **Parent:** "text" -> **[tags]**
      const match = line.match(/\*\*Parent:\*\*\s*"([^"]+)"\s*->\s*(.+)/);
      if (match) {
        const utteranceText = match[1].trim();
        const tagsText = match[2];

        // Extract all tags from the line
        const tagMatches = tagsText.matchAll(/\*\*\[([^\]]+)\]\*\*/g);
        const tags = Array.from(tagMatches, m => m[1]);

        // Find matching utterance in transcript
        transcript.forEach((utterance, index) => {
          // Normalize text for comparison (remove extra spaces, punctuation differences)
          const normalizedUtterance = utterance.text
            .toLowerCase()
            .replace(/[.,!?;()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const normalizedCoding = utteranceText
            .toLowerCase()
            .replace(/[.,!?;()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (normalizedUtterance.includes(normalizedCoding) || normalizedCoding.includes(normalizedUtterance)) {
            utteranceTags[index] = tags;
          }
        });
      }
    });

    return utteranceTags;
  };

  // Get tag styling
  const getTagStyle = (tag) => {
    if (tag.startsWith('DO:')) {
      return 'bg-green-100 text-green-700 border-green-300';
    } else if (tag.startsWith('DON\'T:')) {
      return 'bg-red-100 text-red-700 border-red-300';
    } else if (tag === 'Neutral') {
      return 'bg-gray-100 text-gray-600 border-gray-300';
    }
    return 'bg-blue-100 text-blue-700 border-blue-300';
  };

  const utteranceTags = parseTagsFromCoding(pcitCoding, transcript);

  // Parse competency analysis into sections
  const parseCompetencyAnalysis = (analysisText) => {
    if (!analysisText) return null;

    const sections = {
      intro: '',
      strengths: [],
      areasForGrowth: [],
      nextSteps: []
    };

    const lines = analysisText.split('\n');
    let currentSection = 'intro';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.includes('**Strengths:**')) {
        currentSection = 'strengths';
      } else if (trimmed.includes('**Areas for Growth:**')) {
        currentSection = 'areasForGrowth';
      } else if (trimmed.includes('**Next Steps:**')) {
        currentSection = 'nextSteps';
      } else if (trimmed.startsWith('✓') || trimmed.startsWith('•')) {
        // Remove bullet points and trim
        const item = trimmed.replace(/^[✓•]\s*/, '').trim();
        if (item && currentSection !== 'intro') {
          sections[currentSection].push(item);
        }
      } else if (currentSection === 'intro' && trimmed) {
        sections.intro += (sections.intro ? ' ' : '') + trimmed;
      }
    });

    return sections;
  };

  const competencySections = parseCompetencyAnalysis(competencyAnalysis);

  const error = recorderError || processingError;
  const tagCounts = mode === 'CDI' ? countPcitTags(pcitCoding) : countPdiTags(pcitCoding);

  return (
    <div className="min-h-screen bg-white pb-24 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setActiveScreen('learn')}
            className="p-2 -ml-2"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <button
            onClick={() => setPreviewEnabled(!previewEnabled)}
            className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
              previewEnabled
                ? 'bg-purple-100 text-purple-700 border-purple-300'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {previewEnabled ? '✓ PREVIEW MODE' : 'PREVIEW MODE'}
          </button>
        </div>
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
          {/* Dino Mascot */}
          <div className="flex-1 flex items-center justify-center px-6">
            <img
              src={dinoImage}
              alt="Happy Dino Mascot"
              className="w-48 h-48 object-contain"
            />
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
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex justify-center">
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

            <p className="text-center text-gray-500 text-sm">
              {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
            </p>

            {isRecording && (
              <button
                onClick={handleCancelRecording}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel Recording
              </button>
            )}
          </div>
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
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Collapsible Transcript Button */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full mb-4 bg-white border-2 border-gray-300 hover:border-gray-400 rounded-xl p-4 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <Mic className="w-5 h-5 text-gray-600" />
              </div>
              <div className="text-left">
                <h2 className="text-md font-bold text-gray-800">Conversation Transcript</h2>
                <p className="text-xs text-gray-500">
                  {transcript?.length || 0} utterances • Click to {showTranscript ? 'hide' : 'view'}
                </p>
              </div>
            </div>
            {showTranscript ? (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {/* Transcript Content - Collapsible */}
          {showTranscript && (
            <div className="space-y-3 mb-6 animate-fadeIn">
              {transcript && transcript.map((utterance, index) => {
                // Validate utterance has required properties
                if (!utterance || typeof utterance.speaker !== 'number' || !utterance.text) {
                  return (
                    <div key={index} className="p-3 rounded-xl border bg-gray-100 border-gray-300">
                      <p className="text-gray-500 text-sm italic">Invalid utterance data</p>
                    </div>
                  );
                }

                const isParent = parentSpeaker !== null && utterance.speaker === parentSpeaker;
                const tags = utteranceTags[index] || [];

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-xl border ${getSpeakerColor(utterance.speaker)}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-600">
                        {getSpeakerName(utterance.speaker)}
                      </p>
                      {isParent && tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getTagStyle(tag)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-800 text-sm">{utterance.text}</p>
                  </div>
                );
              })}
            </div>
          )}

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

          {/* Speaker Identification - Hidden per user request */}
          {/* {analysis && (
            <div className="mb-6">
              <h3 className="text-md font-bold text-gray-800 mb-3">Speaker Identification</h3>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{analysis}</p>
              </div>
            </div>
          )} */}

          {/* CDI Mastery Criteria Info Box */}
          {mode === 'CDI' && (
            <div className="mb-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Info className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-purple-900 mb-2">CDI Mastery Criteria</h3>
                    <p className="text-sm text-purple-800 mb-3">
                      Before graduating from CDI, it is ideal to show mastery of the CDI skills during 5 minutes of Special Time:
                    </p>
                    <div className="bg-white rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700"><strong>10</strong> Labeled Praises</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700"><strong>10</strong> Descriptions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700"><strong>10</strong> Reflections</span>
                      </div>
                      <div className="h-px bg-gray-200 my-2"></div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700"><strong>3 or fewer</strong> total Questions, Commands, and Criticisms</span>
                      </div>
                    </div>
                  </div>
                </div>
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
                          <span className={`font-medium ${tagCounts.praise >= 10 ? 'text-green-600 font-bold' : ''}`}>
                            {tagCounts.praise}
                            {tagCounts.praise >= 10 && ' ✓'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Reflection</span>
                          <span className={`font-medium ${tagCounts.reflect >= 10 ? 'text-green-600 font-bold' : ''}`}>
                            {tagCounts.reflect}
                            {tagCounts.reflect >= 10 && ' ✓'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Imitation</span>
                          <span className="font-medium">{tagCounts.imitate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Description</span>
                          <span className={`font-medium ${tagCounts.describe >= 10 ? 'text-green-600 font-bold' : ''}`}>
                            {tagCounts.describe}
                            {tagCounts.describe >= 10 && ' ✓'}
                          </span>
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
                        <span className={`font-bold ${tagCounts.totalAvoid <= 3 ? 'text-green-600' : 'text-red-600'}`}>
                          {tagCounts.totalAvoid}
                          {tagCounts.totalAvoid <= 3 && ' ✓'}
                        </span>
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

          {/* Competency Analysis - Redesigned */}
          {competencySections && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Your Feedback & Recommendations</h3>

              {/* Intro Message */}
              {competencySections.intro && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 mb-4 border border-green-200">
                  <p className="text-gray-700 text-sm font-medium">{competencySections.intro}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Strengths */}
                {competencySections.strengths.length > 0 && (
                  <div className="bg-white border-2 border-green-300 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-md font-bold text-green-700">Strengths</h4>
                    </div>
                    <ul className="space-y-2">
                      {competencySections.strengths.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Areas for Growth */}
                {competencySections.areasForGrowth.length > 0 && (
                  <div className="bg-white border-2 border-orange-300 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-md font-bold text-orange-700">Areas for Growth</h4>
                    </div>
                    <ul className="space-y-2">
                      {competencySections.areasForGrowth.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-orange-500 mt-0.5 flex-shrink-0"></div>
                          <span className="text-sm text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Next Steps */}
                {competencySections.nextSteps.length > 0 && (
                  <div className="bg-white border-2 border-blue-300 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-md font-bold text-blue-700">Next Steps</h4>
                    </div>
                    <ul className="space-y-2">
                      {competencySections.nextSteps.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                          <span className="text-sm text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PCIT Coding Details - Hidden, tags now shown inline in transcript */}
          {/* {pcitCoding && (
            <div className="mb-6">
              <h3 className="text-md font-bold text-gray-800 mb-3">PCIT Coding Details</h3>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{pcitCoding}</p>
              </div>
            </div>
          )} */}

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
