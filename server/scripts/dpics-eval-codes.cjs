'use strict';

/**
 * Known DPICS code families where the gold-standard transcripts (coded under
 * an older manual revision) and the current production prompt (newer manual,
 * see doc/dpicsCoding.md and the 5324c1a commit) use different granularity
 * for what is functionally the same construct. Used to compute a lenient
 * "category match" accuracy alongside strict exact-match, so manual-version
 * drift doesn't get counted as a model coding error.
 *
 * - {Q, DQ, IQ, RQ}: DQ/IQ are documented in scoreConstants.cjs as "(new manual)"
 *   sub-splits of the generic Question code. RQ (Reflective Question, old manual)
 *   is the question-form analog of RF — per the old manual's own paired examples
 *   it shares RF's content-preservation rule, not Q/DQ/IQ's information-seeking
 *   function — but per explicit instruction it is treated as equivalent to Q here.
 * - {LP, LP1, LP2, LP3, LP4}: scoreConstants.cjs explicitly documents LP as
 *   "legacy — sub-classified as LP1-LP4 in new sessions".
 * - AN folded into the same group: dpicsCoding-v3.txt listed AN (Answer) in
 *   its valid-codes enumeration with no decision rule, and the model started
 *   over-applying it to ordinary TA affirmatives ("對阿"/"好啊"/"會阿") that
 *   the gold transcripts coded TA. Per explicit instruction, AN is treated as
 *   equivalent to TA for scoring until/unless a real AN-vs-TA rule is added
 *   to the prompt.
 * - AK, ID folded into the same group: the old manual (DPICS-Manual.2.18.pdf,
 *   "DPICS-TC") has no standalone TA code at all — "PARENT TALK (TA)" is a
 *   section header, not a code; its only real leaf codes are AK
 *   (Acknowledgement) and ID (Informational Description). dpicsCoding-v5.txt
 *   constrains the model to the old manual's code set, so generic neutral
 *   talk correctly comes out as AK/ID instead of TA — that's a vocabulary
 *   translation, not a coding error, so AK/ID are treated as equivalent to
 *   TA for scoring under the old-manual prompt. Per explicit instruction.
 */
const CODE_GROUPS = [
  ['Q', 'DQ', 'IQ', 'RQ'],
  ['LP', 'LP1', 'LP2', 'LP3', 'LP4'],
  ['TA', 'AN', 'AK', 'ID'],
];

const GROUP_BY_CODE = {};
for (const group of CODE_GROUPS) {
  const key = group.join('/');
  for (const code of group) GROUP_BY_CODE[code] = key;
}

function categoryOf(code) {
  if (!code) return null;
  return GROUP_BY_CODE[code] || code;
}

function sameCategory(codeA, codeB) {
  if (!codeA || !codeB) return false;
  return categoryOf(codeA) === categoryOf(codeB);
}

module.exports = { CODE_GROUPS, categoryOf, sameCategory };
