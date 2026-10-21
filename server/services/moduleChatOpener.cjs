'use strict';

/**
 * Nora's opening message in the Screen Time module chat (POST /api/coach/start),
 * filled in from the onboarding answers (User.screenTimeIntake) without an LLM
 * call, following "Before the First Recording" in prompts/coach-screentime.txt:
 * greet, reflect the main problem and what they've tried, then ONE question.
 *
 * Answer values mirror server/utils/screenTimeIntake.cjs — keep in sync.
 */

const COPY = {
  en: {
    greet: (parent, child) => `Hi${parent ? ` ${parent}` : ''}! I'm Nora, and I'm here to help make screen time endings easier with ${child}.`,
    highStress: 'I know these endings have been really hard on you lately.',
    hardest: {
      resist:         c => `You mentioned ${c} resists or refuses to stop`,
      long_meltdowns: () => 'You mentioned the meltdowns can last a long time',
      stay_calm:      () => "You mentioned it's hard to stay calm when screen time ends",
      consistency:    () => "You mentioned it's hard to stay consistent",
      exhausted:      () => "You mentioned you're exhausted and running out of things to try",
      stop:           c => `You mentioned getting ${c} to stop is the hardest part`,
      more:           c => `You mentioned ${c} keeps asking for more`,
      upset:          c => `You mentioned ${c} gets very upset when it ends`,
      after:          c => `You mentioned ${c} won't do anything else afterward`,
      argue:          () => 'You mentioned it often ends in arguing or yelling',
    },
    triedAfterHardest: list => `, and you've already tried ${list}`,
    triedAlone:        list => `You've already tried ${list}`,
    strategies: {
      warning:    'giving a warning',
      timer:      'a timer',
      rules:      'setting rules in advance',
      activity:   'offering another activity',
      explaining: "explaining why it's time to stop",
      extra:      'giving a little extra time',
      away:       'taking the device away',
    },
    list: items => (items.length > 3
      ? `${items.slice(0, 3).join(', ')} and more`
      : items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0]),
    worked: {
      smoothly:    ', and it usually goes smoothly',
      improvement: ", which has helped a bit",
      sometimes:   ', which only helps sometimes',
      no_change:   ' without much change',
      harder:      ", but it's getting harder",
    },
    end: '.',
    askWhatHappens: c => `What usually happens when it's time for ${c} to stop?`,
    options: 'OPTIONS: Ignores me and keeps watching | Asks for more | Cries or whines | Full meltdown',
    askLastTime: c => `Can you tell me about the last time it happened? What was ${c} watching, and how did it end?`,
    childFallback: 'your child',
  },
  'zh-CN': {
    greet: (parent, child) => `${parent ? `${parent}，` : ''}你好！我是 Nora，我会陪你一起让${child}的屏幕时间结束得更顺利。`,
    highStress: '我知道最近每次结束屏幕时间，对你来说都很辛苦。',
    hardest: {
      resist:         c => `你提到${c}会抗拒、不肯停下来`,
      long_meltdowns: c => `你提到${c}的情绪崩溃有时会持续很久`,
      stay_calm:      () => '你提到屏幕时间结束时，你很难保持冷静',
      consistency:    () => '你提到很难一直坚持同样的做法',
      exhausted:      () => '你提到你已经很累，不知道还能试什么',
      stop:           c => `你提到最难的是让${c}停下来`,
      more:           c => `你提到${c}总是要求再看一会儿`,
      upset:          c => `你提到结束时${c}会非常难过`,
      after:          c => `你提到结束后${c}不愿意做别的事`,
      argue:          () => '你提到最后常常变成争吵或吼叫',
    },
    triedAfterHardest: list => `，也已经试过${list}`,
    triedAlone:        list => `你已经试过${list}`,
    strategies: {
      warning:    '提前提醒',
      timer:      '用计时器',
      rules:      '事先定好规则',
      activity:   '提供其他活动',
      explaining: '解释为什么要停',
      extra:      '多给一点时间',
      away:       '直接拿走设备',
    },
    list: items => (items.length > 3 ? `${items.slice(0, 3).join('、')}等方法` : items.join('、')),
    worked: {
      smoothly:    '，通常都能顺利结束',
      improvement: '，有一些改善',
      sometimes:   '，但只是有时候有用',
      no_change:   '，但没什么改变',
      harder:      '，但情况越来越难了',
    },
    end: '。',
    askWhatHappens: c => `到了该停下来的时候，${c}通常会怎么样？`,
    options: 'OPTIONS: 不理我，继续看 | 要求再看一会儿 | 哭闹或抱怨 | 情绪完全崩溃',
    askLastTime: c => `可以跟我说说最近一次的情况吗？${c}当时在看什么，最后是怎么结束的？`,
    childFallback: '孩子',
  },
  'zh-TW': {
    greet: (parent, child) => `${parent ? `${parent}，` : ''}你好！我是 Nora，我會陪你一起讓${child}的螢幕時間結束得更順利。`,
    highStress: '我知道最近每次結束螢幕時間，對你來說都很辛苦。',
    hardest: {
      resist:         c => `你提到${c}會抗拒、不肯停下來`,
      long_meltdowns: c => `你提到${c}的情緒崩潰有時會持續很久`,
      stay_calm:      () => '你提到螢幕時間結束時，你很難保持冷靜',
      consistency:    () => '你提到很難一直堅持同樣的做法',
      exhausted:      () => '你提到你已經很累，不知道還能試什麼',
      stop:           c => `你提到最難的是讓${c}停下來`,
      more:           c => `你提到${c}總是要求再看一下`,
      upset:          c => `你提到結束時${c}會非常難過`,
      after:          c => `你提到結束後${c}不願意做別的事`,
      argue:          () => '你提到最後常常變成爭吵或吼叫',
    },
    triedAfterHardest: list => `，也已經試過${list}`,
    triedAlone:        list => `你已經試過${list}`,
    strategies: {
      warning:    '提前提醒',
      timer:      '用計時器',
      rules:      '事先訂好規則',
      activity:   '提供其他活動',
      explaining: '解釋為什麼要停',
      extra:      '多給一點時間',
      away:       '直接拿走裝置',
    },
    list: items => (items.length > 3 ? `${items.slice(0, 3).join('、')}等方法` : items.join('、')),
    worked: {
      smoothly:    '，通常都能順利結束',
      improvement: '，有一些改善',
      sometimes:   '，但只是有時候有用',
      no_change:   '，但沒什麼改變',
      harder:      '，但情況越來越難了',
    },
    end: '。',
    askWhatHappens: c => `到了該停下來的時候，${c}通常會怎麼樣？`,
    options: 'OPTIONS: 不理我，繼續看 | 要求再看一下 | 哭鬧或抱怨 | 情緒完全崩潰',
    askLastTime: c => `可以跟我說說最近一次的情況嗎？${c}當時在看什麼，最後是怎麼結束的？`,
    childFallback: '孩子',
  },
};

// Same as the prompt's "high stress" rule: only then acknowledge how hard it is on them.
const HIGH_STRESS = new Set(['very', 'overwhelming']);
const HIGH_STRESS_HARDEST = new Set(['stay_calm', 'exhausted']);

/**
 * @param {Object} p
 * @param {string} [p.locale]      - 'en' | 'zh-CN' | 'zh-TW'
 * @param {string} [p.parentName]  - decrypted; only the first name is used
 * @param {string} [p.childName]   - decrypted
 * @param {Object|null} [p.intake] - User.screenTimeIntake
 * @returns {string} the message text, with an OPTIONS line when it asks a choice
 */
function buildModuleChatOpener({ locale, parentName, childName, intake }) {
  const copy = COPY[locale] || COPY.en;
  const child = childName || copy.childFallback;
  const first = parentName?.trim().split(/\s+/)[0] || '';
  const a = intake && typeof intake === 'object' ? intake : {};

  const paragraphs = [copy.greet(first, child)];

  const hardest = Array.isArray(a.hardest) ? a.hardest[0] : a.hardest;
  const tried = (Array.isArray(a.strategies) ? a.strategies : [])
    .map(s => copy.strategies[s])
    .filter(Boolean);
  const worked = Array.isArray(a.worked) ? a.worked[0] : a.worked;

  let reflect = '';
  const hardestLine = copy.hardest[hardest];
  if (hardestLine) reflect = hardestLine(child);
  if (tried.length) {
    reflect += reflect ? copy.triedAfterHardest(copy.list(tried)) : copy.triedAlone(copy.list(tried));
    reflect += copy.worked[worked] || '';
  }
  const highStress = HIGH_STRESS.has(a.stress) || HIGH_STRESS_HARDEST.has(hardest);
  const middle = [highStress ? copy.highStress : '', reflect ? reflect + copy.end : ''].filter(Boolean);
  if (middle.length) paragraphs.push(middle.join(locale === 'en' || !COPY[locale] ? ' ' : ''));

  // "What happens at the end" is no longer asked in onboarding; older accounts answered it.
  const knowsWhatHappens = Array.isArray(a.stops) ? a.stops.length > 0 : !!a.stops;
  paragraphs.push(knowsWhatHappens ? copy.askLastTime(child) : `${copy.askWhatHappens(child)}\n${copy.options}`);

  return paragraphs.join('\n\n');
}

module.exports = { buildModuleChatOpener };
