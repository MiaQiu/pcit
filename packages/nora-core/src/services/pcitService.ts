import type AuthService from './authService';
import type {
  TranscriptionSegment,
  CDICounts,
  PDICounts,
  CDIMastery,
  FlaggedItem,
  AnalysisResult,
  CompetencyAnalysis,
} from '../types';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/**
 * PCIT Analysis Service
 * PDPA compliant with backend proxy - all Claude API requests go through anonymization proxy
 */
class PCITService {
  private authService: AuthService;
  private apiUrl: string;

  constructor(authService: AuthService, apiUrl: string) {
    this.authService = authService;
    this.apiUrl = apiUrl;
  }

  /**
   * Validate transcript input
   */
  private validateTranscript(transcript: TranscriptionSegment[]): void {
    if (!transcript) {
      throw new Error('No transcript provided');
    }
    if (!Array.isArray(transcript)) {
      throw new Error('Transcript must be an array');
    }
    if (transcript.length === 0) {
      throw new Error('Transcript is empty');
    }
    // Validate each utterance has required fields
    for (let i = 0; i < transcript.length; i++) {
      const utterance = transcript[i];
      if (typeof utterance.speaker !== 'number' && typeof utterance.speaker !== 'string') {
        throw new Error(`Invalid speaker at index ${i}`);
      }
      if (typeof utterance.text !== 'string' || !utterance.text.trim()) {
        throw new Error(`Invalid or empty text at index ${i}`);
      }
    }
  }

  /**
   * Validate CDI counts input
   */
  private validateCDICounts(counts: CDICounts): void {
    if (!counts || typeof counts !== 'object') {
      throw new Error('Invalid counts object');
    }
    const requiredFields: (keyof CDICounts)[] = [
      'praise',
      'echo',
      'narration',
      'question',
      'command',
      'criticism',
      'negative_phrases',
      'neutral',
    ];
    for (const field of requiredFields) {
      if (typeof counts[field] !== 'number') {
        throw new Error(`Missing or invalid count for: ${field}`);
      }
    }
  }

  /**
   * Validate PDI counts input
   */
  private validatePDICounts(counts: PDICounts): void {
    if (!counts || typeof counts !== 'object') {
      throw new Error('Invalid counts object');
    }
    const requiredFields: (keyof PDICounts)[] = [
      'direct_command',
      'positive_command',
      'specific_command',
      'labeled_praise',
      'correct_warning',
      'correct_timeout',
      'indirect_command',
      'negative_command',
      'vague_command',
      'chained_command',
      'harsh_tone',
      'neutral',
    ];
    for (const field of requiredFields) {
      if (typeof counts[field] !== 'number') {
        throw new Error(`Missing or invalid count for: ${field}`);
      }
    }
  }

  /**
   * Combined speaker identification and PCIT coding (CDI)
   */
  async analyzeAndCode(transcript: TranscriptionSegment[]): Promise<AnalysisResult> {
    this.validateTranscript(transcript);

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/pcit/speaker-and-coding`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Analysis failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      parentSpeaker: result.parentSpeaker,
      coding: result.coding,
      fullResponse: result.fullResponse,
    };
  }

  /**
   * Get competency analysis (CDI)
   */
  async getCompetencyAnalysis(counts: CDICounts): Promise<CompetencyAnalysis> {
    this.validateCDICounts(counts);

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/pcit/competency-analysis`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ counts }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Competency analysis failed: ${response.status}`
      );
    }

    const result = await response.json();
    return result.analysis;
  }

  /**
   * Count PCIT tags from coding text (CDI)
   */
  countPcitTags(codingText: string): CDICounts | null {
    if (!codingText) return null;
    if (typeof codingText !== 'string') {
      console.error('countPcitTags: expected string, got', typeof codingText);
      return null;
    }

    const counts: CDICounts = {
      narration: (codingText.match(/\[DO:\s*Narration\]/gi) || []).length,
      echo: (codingText.match(/\[DO:\s*Echo\]/gi) || []).length,
      praise: (codingText.match(/\[DO:\s*Praise\]/gi) || []).length,
      question: (codingText.match(/\[DON'T:\s*Question\]/gi) || []).length,
      command: (codingText.match(/\[DON'T:\s*Command\]/gi) || []).length,
      criticism: (codingText.match(/\[DON'T:\s*Criticism\]/gi) || []).length,
      negative_phrases: (codingText.match(/\[DON'T:\s*Negative\s*Phrases?\]/gi) || [])
        .length,
      neutral: (codingText.match(/\[Neutral\]/gi) || []).length,
    };

    counts.totalPen = counts.narration + counts.echo + counts.praise;
    counts.totalAvoid =
      counts.question + counts.command + counts.criticism + counts.negative_phrases;

    return counts;
  }

  /**
   * PDI (Parent-Directed Interaction) speaker identification and coding
   */
  async pdiAnalyzeAndCode(transcript: TranscriptionSegment[]): Promise<AnalysisResult> {
    this.validateTranscript(transcript);

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/pcit/pdi-speaker-and-coding`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `PDI analysis failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      parentSpeaker: result.parentSpeaker,
      coding: result.coding,
      fullResponse: result.fullResponse,
    };
  }

  /**
   * PDI competency analysis
   */
  async getPdiCompetencyAnalysis(counts: PDICounts): Promise<CompetencyAnalysis> {
    this.validatePDICounts(counts);

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/pcit/pdi-competency-analysis`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ counts }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `PDI competency analysis failed: ${response.status}`
      );
    }

    const result = await response.json();
    return result.analysis;
  }

  /**
   * Count PDI tags from coding text
   */
  countPdiTags(codingText: string): PDICounts | null {
    if (!codingText) return null;
    if (typeof codingText !== 'string') {
      console.error('countPdiTags: expected string, got', typeof codingText);
      return null;
    }

    const counts: PDICounts = {
      // Effective commands (DO)
      direct_command: (codingText.match(/\[DO:\s*Direct\s*Command\]/gi) || []).length,
      positive_command: (codingText.match(/\[DO:\s*Positive\s*Command\]/gi) || [])
        .length,
      specific_command: (codingText.match(/\[DO:\s*Specific\s*Command\]/gi) || [])
        .length,
      labeled_praise: (codingText.match(/\[DO:\s*Labeled\s*Praise\]/gi) || []).length,
      correct_warning: (codingText.match(/\[DO:\s*Correct\s*Warning\]/gi) || []).length,
      correct_timeout: (
        codingText.match(/\[DO:\s*Correct\s*Time-?Out\s*Statement\]/gi) || []
      ).length,
      // Ineffective commands (DON'T)
      indirect_command: (codingText.match(/\[DON'T:\s*Indirect\s*Command\]/gi) || [])
        .length,
      negative_command: (codingText.match(/\[DON'T:\s*Negative\s*Command\]/gi) || [])
        .length,
      vague_command: (codingText.match(/\[DON'T:\s*Vague\s*Command\]/gi) || []).length,
      chained_command: (codingText.match(/\[DON'T:\s*Chained\s*Command\]/gi) || [])
        .length,
      harsh_tone: (codingText.match(/\[DON'T:\s*Harsh\s*Tone\]/gi) || []).length,
      // Neutral
      neutral: (codingText.match(/\[Neutral\]/gi) || []).length,
    };

    // Calculate totals
    counts.totalEffective =
      counts.direct_command + counts.positive_command + counts.specific_command;
    counts.totalIneffective =
      counts.indirect_command +
      counts.negative_command +
      counts.vague_command +
      counts.chained_command;
    counts.totalCommands = counts.totalEffective + counts.totalIneffective;
    counts.effectivePercent =
      counts.totalCommands > 0
        ? Math.round((counts.totalEffective / counts.totalCommands) * 100)
        : 0;

    return counts;
  }

  /**
   * Check if CDI criteria is met (for transitioning to PDI)
   */
  checkCdiMastery(counts: CDICounts): CDIMastery {
    if (!counts) {
      return {
        mastered: false,
        criteria: {
          praise: { target: 10, met: false },
          echo: { target: 10, met: false },
          narration: { target: 10, met: false },
          totalAvoid: { target: 3, met: false },
          negative_phrases: { target: 0, met: false },
        },
      };
    }

    const criteria = {
      praise: { target: 10, met: counts.praise >= 10 },
      echo: { target: 10, met: counts.echo >= 10 },
      narration: { target: 10, met: counts.narration >= 10 },
      totalAvoid: { target: 3, met: (counts.totalAvoid || 0) <= 3 },
      negative_phrases: { target: 0, met: counts.negative_phrases === 0 },
    };

    const mastered =
      criteria.praise.met &&
      criteria.echo.met &&
      criteria.narration.met &&
      criteria.totalAvoid.met &&
      criteria.negative_phrases.met;

    return { mastered, criteria };
  }

  /**
   * Extract utterances flagged with negative phrases for human review
   */
  extractNegativePhraseFlags(
    codingText: string,
    transcript: TranscriptionSegment[]
  ): FlaggedItem[] {
    if (!codingText || !transcript || !Array.isArray(transcript)) {
      return [];
    }

    const flaggedItems: FlaggedItem[] = [];

    // Find all lines with negative phrases tag
    const lines = codingText.split('\n');
    for (const line of lines) {
      if (/\[DON'T:\s*Negative\s*Phrases?\]/i.test(line)) {
        // Extract the quoted dialogue from the line
        const dialogueMatch = line.match(/[""]([^""]+)[""]/);
        if (dialogueMatch) {
          const dialogue = dialogueMatch[1].trim().toLowerCase();

          // Find matching utterance in transcript to get timestamp
          for (const utterance of transcript) {
            if (
              utterance.text &&
              utterance.text.toLowerCase().includes(dialogue.substring(0, 20))
            ) {
              flaggedItems.push({
                text: utterance.text,
                speaker: typeof utterance.speaker === 'number' ? utterance.speaker : null,
                timestamp: utterance.start || 0,
                reason: 'Negative phrase detected - requires human coach review',
              });
              break;
            }
          }

          // If no timestamp match found, still flag it without timestamp
          if (
            flaggedItems.length === 0 ||
            flaggedItems[flaggedItems.length - 1].text !== dialogueMatch[1]
          ) {
            flaggedItems.push({
              text: dialogueMatch[1],
              speaker: null,
              timestamp: null,
              reason: 'Negative phrase detected - requires human coach review',
            });
          }
        }
      }
    }

    return flaggedItems;
  }

  /**
   * Send coach alert email
   */
  async sendCoachAlert(
    flaggedItems: FlaggedItem[],
    sessionInfo: any = null
  ): Promise<any> {
    if (!flaggedItems || flaggedItems.length === 0) {
      throw new Error('No flagged items to send');
    }

    const response = await fetchWithTimeout(
      `${this.apiUrl}/send-coach-alert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flaggedItems, sessionInfo }),
      },
      30000 // 30s timeout for email
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to send alert: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<any> {
    try {
      const response = await fetchWithTimeout(`${this.apiUrl}/health`, {}, 5000);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      return response.json();
    } catch (err: any) {
      throw new Error(`Backend unavailable: ${err.message}`);
    }
  }
}

export default PCITService;
