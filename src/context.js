// 多轮上下文。银行对话里最常出现的不是完整句子，而是"再转 200""改成 500""她也加上"。
// 这里维护最近一次意图，供 nlu 在规则匹配失败时做补全。

const CN_NUM = '[零〇一二两三四五六七八九十百千万]+';
const AMOUNT = `(${CN_NUM}|\\d[\\d,]*(?:\\.\\d+)?)`;

const FOLLOW_UPS = [
  {
    // 再转 200 / 再来一笔 500 / 继续转 1000
    re: new RegExp(`^(?:再|再来|还要|继续|接着)(?:转|付|打|汇)?(?:一笔)?\\s*[^\\d零〇一二两三四五六七八九十百千万]{0,4}?${AMOUNT}\\s*(?:元|块)?`),
    kind: 'repeat'
  },
  {
    // 改成 500 / 换成 1200 / 调整为 300
    re: new RegExp(`^(?:改成|换成|改为|调整为|调成)\\s*${AMOUNT}\\s*(?:元|块)?`),
    kind: 'amend'
  },
  {
    // 她 / 他 / 对方 —— 指代上一位收款人
    re: /^(?:她|他|对方|这个人|还是刚才那个)/,
    kind: 'pronoun'
  }
];

function toNumber(token, cn2num) {
  if (!token) return NaN;
  const clean = String(token).replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(clean)) return Number(clean);
  return cn2num(clean);
}

/**
 * 尝试用上一轮上下文补全这句话。
 * @param {string} text 用户输入
 * @param {object|null} last 上一轮意图 { action, slots }
 * @param {function} cn2num 中文数字转换
 * @returns {object|null} 合成意图，或 null 表示不需要补全
 */
export function resolveFollowUp(text, last, cn2num) {
  const raw = String(text || '').trim();
  if (!raw || !last || !last.action) return null;

  for (const rule of FOLLOW_UPS) {
    const m = raw.match(rule.re);
    if (!m) continue;

    if (rule.kind === 'repeat') {
      const amount = toNumber(m[1], cn2num);
      if (!Number.isFinite(amount)) return null;
      return {
        action: last.action,
        slots: { ...last.slots, amount },
        confidence: 0.86,
        evidence: `上下文补全：沿用上一笔的${last.slots.payee ? '收款人' + last.slots.payee : '对象'}`,
        fromContext: true
      };
    }

    if (rule.kind === 'amend') {
      const amount = toNumber(m[1], cn2num);
      if (!Number.isFinite(amount)) return null;
      return {
        action: last.action,
        slots: { ...last.slots, amount },
        confidence: 0.88,
        evidence: `上下文补全：把金额改为 ${amount} 元`,
        fromContext: true
      };
    }

    if (rule.kind === 'pronoun' && last.slots && last.slots.payee) {
      return {
        action: last.action,
        slots: { ...last.slots },
        confidence: 0.72,
        evidence: `上下文补全：指代上一位收款人 ${last.slots.payee}`,
        fromContext: true
      };
    }
  }

  return null;
}

export class SessionContext {
  constructor() {
    this.last = null;
  }

  remember(intent) {
    if (!intent || !intent.action) return;
    this.last = { action: intent.action, slots: { ...intent.slots } };
  }

  peek() {
    return this.last;
  }

  clear() {
    this.last = null;
  }
}
