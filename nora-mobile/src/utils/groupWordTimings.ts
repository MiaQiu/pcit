import type { WordTiming } from '@nora/core';

export interface WordSentence {
  words: WordTiming[];
  start: number;
  end: number;
}

const SENTENCE_END = /[.!?]["')\]]?$/;

/**
 * Groups a flat word-timing array (from forced alignment/transcription) into
 * sentences, so LiveScriptCard can auto-scroll at sentence granularity while
 * still coloring individual words. Heuristic only (doesn't special-case
 * abbreviations like "Mr."), which is fine for scroll grouping purposes.
 */
export function groupWordTimingsIntoSentences(words: WordTiming[]): WordSentence[] {
  const sentences: WordSentence[] = [];
  let current: WordTiming[] = [];

  for (const word of words) {
    current.push(word);
    if (SENTENCE_END.test(word.text.trim())) {
      sentences.push({ words: current, start: current[0].start, end: current[current.length - 1].end });
      current = [];
    }
  }
  if (current.length > 0) {
    sentences.push({ words: current, start: current[0].start, end: current[current.length - 1].end });
  }
  return sentences;
}
