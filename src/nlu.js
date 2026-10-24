// 规则型意图识别。设计上刻意不用大模型做第一道判断：
// 银行场景里"少一次误判"比"多一种说法"更值钱，规则层可解释、可回归测试、断网也能跑。
// 大模型只在规则置信度不足时兜底，见 llm.js。

import { resolveFollowUp } from './context.js';

const DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNITS = { 十: 10, 百: 100, 千: 1000 };

export function cn2num(raw) {
  const text = String(raw || '');
  if (!text) return NaN;
  let total = 0;
  let section = 0;
  let number = 0;
  let lastUnit = 1;
  let sawZero = false;

  for (const ch of text) {
    if (ch in DIGITS) {
      if (DIGITS[ch] === 0) sawZero = true;
      number = DIGITS[ch];
      continue;
    }
    if (ch in UNITS) {
      const unit = UNITS[ch];
      if (number === 0) number = 1;
      section += number * unit;
      lastUnit = unit;
      number = 0;
      sawZero = false;
      continue;
    }
    if (ch === '万') {
      section = (section + number) * 10000;
      total += section;
      section = 0;
      number = 0;
      lastUnit = 10000;
      sawZero = false;
      continue;
    }
    if (/\s/.test(ch)) continue;
    return NaN;
  }

  if (number > 0) {
    // "一千二"这种口语省略，末位数字代表下一个量级
    if (lastUnit > 1 && !sawZero) section += (number * lastUnit) / 10;
    else section += number;
  }
  return total + section;
}

function toNumber(token) {
  if (!token) return NaN;
  const cleaned = String(token).replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  return cn2num(cleaned);
}

const CN_NUM = '[零〇一二两三四五六七八九十百千万]+';

export function findAmount(text) {
  const patterns = [
    new RegExp(`(${CN_NUM})\\s*(?:元|块钱|块)`),
    /(\d[\d,]*(?:\.\d+)?)\s*(?:元|块钱|块)/,
    new RegExp(`(?:转|打|汇|付|买|申购|赎回|充值|提额|调整到)\\s*(?:给|到|入)?[^\\d零〇一二两三四五六七八九十百千万]{0,6}?(${CN_NUM}|\\d[\\d,]*(?:\\.\\d+)?)`),
    new RegExp(`(${CN_NUM}|\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:转给|打给|汇给|付给)`)
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const start = m.index ?? 0;
    const tail = text.slice(start + m[0].length, start + m[0].length + 2);
    if (/^[号日年月点折%]/.test(tail)) continue;
    const value = toNumber(m[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  // 纯数字兜底，排除手机号和日期
  const bare = text.match(/(?<![\d])(\d{1,6}(?:\.\d+)?)(?![\d号日年月点])/);
  if (bare) {
    const value = Number(bare[1]);
    if (value > 0 && value < 1000000) return value;
  }
  return NaN;
}

const PAYEE_PATTERNS = [
  /(?:转|打|汇|付)[^\u4e00-\u9fa5]{0,8}给\s*([\u4e00-\u9fa5A-Za-z·]{1,8})/,
  /(?:转给|转账给|打给|汇给|付给)\s*([\u4e00-\u9fa5A-Za-z·]{1,8})/,
  /给\s*([\u4e00-\u9fa5A-Za-z·]{1,8}?)\s*(?:转|打|汇|付)/,
  /向\s*([\u4e00-\u9fa5A-Za-z·]{1,8}?)\s*(?:转|付|支付|汇款)/,
  /(?:转|打|汇)\s*([\u4e00-\u9fa5A-Za-z·]{2,8}?)\s*\d/
];

export function findPayee(text) {
  for (const pattern of PAYEE_PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    let name = m[1].replace(/(元|块|钱|的)$/g, '').trim();
    name = name.replace(/^(我|你|他|她)/, '');
    if (name.length >= 1) return name;
  }
  return '';
}

function findPeriod(text) {
  if (/(上个月|上月|上一个月)/.test(text)) return 'lastMonth';
  if (/(近三个月|最近三个月|近3个月|季度)/.test(text)) return 'quarter';
  if (/(这个月|本月|当月)/.test(text)) return 'thisMonth';
  return 'thisMonth';
}

function findNote(text) {
  const m = text.match(/备注[：:\s]*([^，,。；;]+)/);
  return m ? m[1].trim() : '';
}

function findMonthlyDay(text) {
  const m = text.match(/每(?:个)?月\s*(\d{1,2})\s*[号日]/);
  return m ? Number(m[1]) : NaN;
}

function findProduct(text) {
  const m = text.match(/(朝朝盈|稳健增利|货币基金|短债|定期存款|固收\+?)/);
  return m ? m[1] : '';
}

const RULES = [
  {
    action: 'plan.compile',
    test: (t) => /生日/.test(t) && /(鲜花|蛋糕|礼物|惊喜|安排|准备|订|布置)/.test(t),
    confidence: 0.93,
    slots: (t) => ({ template: 'birthday', budget: findAmount(t) || 1000, occasion: '生日' }),
    evidence: '识别到"生日"与礼品类动作'
  },
  {
    action: 'card.reportLoss',
    test: (t) => /挂失/.test(t),
    confidence: 0.96,
    slots: () => ({}),
    evidence: '命中"挂失"'
  },
  {
    action: 'card.unlock',
    test: (t) => /(解锁|解挂|恢复使用|解除限制)/.test(t),
    confidence: 0.95,
    slots: () => ({}),
    evidence: '命中"解锁/解挂"'
  },
  {
    action: 'card.lock',
    test: (t) => /(锁卡|锁定|冻结|禁止交易|交易限制)/.test(t),
    confidence: 0.94,
    slots: () => ({}),
    evidence: '命中"锁定/冻结"'
  },
  {
    action: 'card.limit',
    test: (t) => /(额度|提额|调额)/.test(t) && !/理财/.test(t),
    confidence: 0.88,
    slots: (t) => ({ amount: findAmount(t) }),
    evidence: '命中"额度/提额"'
  },
  {
    action: 'card.apply',
    test: (t) => /(申请|办|开).{0,6}(虚拟卡|卡)/.test(t) || /虚拟卡/.test(t),
    confidence: 0.86,
    slots: () => ({}),
    evidence: '命中"申请虚拟卡"'
  },
  {
    action: 'budget.insight',
    test: (t) => /(预算|还能花|还能用|剩多少|超支|这个月还剩)/.test(t),
    confidence: 0.89,
    slots: (t) => ({ budget: findAmount(t) }),
    evidence: '命中"预算/还能花多少"'
  },
  {
    action: 'sub.insight',
    test: (t) => /(涨价|提价|变贵|重复扣费|重复订阅|多扣|扣了两次|扣两遍)/.test(t),
    confidence: 0.9,
    slots: () => ({}),
    evidence: '命中"涨价/重复扣费"'
  },
  {
    action: 'sub.cancel',
    test: (t) => /(取消|关闭|退订|停掉)/.test(t) && /(订阅|会员|续费|扣费|包月|健身|视频|音乐|云盘|网盘)/.test(t),
    confidence: 0.92,
    slots: (t) => ({ keyword: (t.match(/(视频|音乐|云存储|云盘|网盘|健身|会员)[^，,。]{0,4}/) || [''])[0] }),
    evidence: '命中"取消订阅"'
  },
  {
    action: 'sub.scan',
    test: (t) => /(订阅|自动扣费|续费|包月|扣费)/.test(t),
    confidence: 0.9,
    slots: () => ({}),
    evidence: '命中"订阅/扣费"'
  },
  {
    action: 'wealth.purchase',
    test: (t) => /(申购|买入|购买|买|投)/.test(t) && /(理财|基金|朝朝盈|稳健)/.test(t),
    confidence: 0.9,
    slots: (t) => ({ amount: findAmount(t), product: findProduct(t) }),
    evidence: '命中"申购/买入 + 理财产品"'
  },
  {
    action: 'wealth.redeem',
    test: (t) => /赎回/.test(t),
    confidence: 0.92,
    slots: (t) => ({ amount: findAmount(t) }),
    evidence: '命中"赎回"'
  },
  {
    action: 'wealth.assess',
    test: (t) => /(风险测评|风险承受|测评|风险等级)/.test(t),
    confidence: 0.9,
    slots: () => ({}),
    evidence: '命中"风险测评"'
  },
  {
    action: 'wealth.recommend',
    test: (t) => /(推荐|建议|哪个好|对比|有没有).{0,10}(理财|产品|基金)/.test(t) || /(理财).{0,6}(推荐|怎么买)/.test(t),
    confidence: 0.87,
    slots: (t) => ({ amount: findAmount(t) }),
    evidence: '命中"推荐/对比 + 理财"'
  },
  {
    action: 'transfer.schedule',
    test: (t) => /(每月|每个月|定时|自动转|定期转)/.test(t) && /转/.test(t),
    confidence: 0.91,
    slots: (t) => ({ payee: findPayee(t), amount: findAmount(t), day: findMonthlyDay(t), note: findNote(t) }),
    evidence: '命中"每月/定时 + 转账"'
  },
  {
    action: 'transfer.collect',
    test: (t) => /(AA|aa|分摊|均摊|收款|收钱|一起付)/.test(t),
    confidence: 0.85,
    slots: (t) => ({ amount: findAmount(t), people: (t.match(/(\d+)\s*(?:个人|人)/) || [])[1] }),
    evidence: '命中"AA/分摊/收款"'
  },
  {
    action: 'transfer.execute',
    test: (t) => /(转账|转给|转|打钱|汇款|付给|打给)/.test(t) && !/理财|赎回|申购/.test(t),
    confidence: 0.9,
    slots: (t) => ({ payee: findPayee(t), amount: findAmount(t), note: findNote(t) }),
    evidence: '命中转账动词'
  },
  {
    action: 'bill.analyze',
    test: (t) => /(账单|花了|支出|消费|开支|花费|分析)/.test(t),
    confidence: 0.88,
    slots: (t) => ({ period: findPeriod(t) }),
    evidence: '命中"账单/支出/分析"'
  },
  {
    action: 'query.transactions',
    test: (t) => /(交易记录|流水|明细|最近.{0,4}笔)/.test(t),
    confidence: 0.9,
    slots: (t) => ({ limit: 5 }),
    evidence: '命中"交易记录/流水"'
  },
  {
    action: 'query.cards',
    test: (t) => /(我的卡|卡片|信用卡)/.test(t),
    confidence: 0.84,
    slots: () => ({}),
    evidence: '命中"卡片"'
  },
  {
    action: 'wealth.query',
    test: (t) => /(理财|持仓|收益)/.test(t),
    confidence: 0.82,
    slots: () => ({}),
    evidence: '命中"理财/收益"'
  },
  {
    action: 'query.balance',
    test: (t) => /(余额|还有多少钱|账上|存款|活期)/.test(t),
    confidence: 0.9,
    slots: () => ({}),
    evidence: '命中"余额/存款"'
  }
];

const REQUIRED_SLOTS = {
  'transfer.execute': ['payee', 'amount'],
  'transfer.schedule': ['payee', 'amount', 'day']
};

const SLOT_LABEL = { payee: '收款人', amount: '金额', day: '每月几号' };

// "预算 1000""备注聚餐"这类片段是补充信息，不单独成意图
function isSupplement(text) {
  const t = String(text).trim();
  return /^(预算|金额|备注|日期|时间|收款人|对象|用途)[：:\s]?/.test(t) && t.length <= 16;
}

function splitClauses(text) {
  return String(text)
    .split(/然后|接着|之后|顺便|；|;|。|\n|，|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseClause(clause) {
  for (const rule of RULES) {
    let hit = false;
    try {
      hit = rule.test(clause) === true;
    } catch (e) {
      hit = false;
    }
    if (!hit) continue;
    const slots = rule.slots(clause);
    const missing = (REQUIRED_SLOTS[rule.action] || []).filter((key) => {
      const v = slots[key];
      return v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v));
    });
    return {
      action: rule.action,
      slots,
      missing,
      missingLabels: missing.map((k) => SLOT_LABEL[k] || k),
      confidence: missing.length ? Math.max(0.4, rule.confidence - 0.25) : rule.confidence,
      evidence: rule.evidence,
      clause
    };
  }
  return null;
}

export function parse(text, options = {}) {
  const raw = String(text || '');
  const parts = splitClauses(raw);
  const clauses = [];
  for (const part of parts) {
    const prev = clauses[clauses.length - 1];
    // 拆出来的碎片如果单独识别不了，就并回上一句，避免"备注聚餐"这种补充信息丢失
    if ((!parseClause(part) || isSupplement(part)) && prev) {
      clauses[clauses.length - 1] = `${prev}，${part}`;
      continue;
    }
    clauses.push(part);
  }

  const intents = [];
  const unknown = [];
  const missing = [];

  // 有上下文时先看是不是续说（"再转 200""改成 500"）
  if (options.last) {
    const synthesized = resolveFollowUp(raw, options.last, cn2num);
    if (synthesized) {
      return {
        text: raw,
        intents: [synthesized],
        unknown: [],
        missing: [],
        confidence: synthesized.confidence,
        fromContext: true
      };
    }
  }

  for (const clause of clauses) {
    const intent = parseClause(clause);
    if (intent) {
      intents.push(intent);
      if (intent.missing.length) {
        missing.push({ action: intent.action, fields: intent.missing, labels: intent.missingLabels, clause });
      }
    } else {
      unknown.push(clause);
    }
  }

  return {
    text,
    intents,
    unknown,
    missing,
    confidence: intents.length === 0 ? 0 : Math.min(...intents.map((i) => i.confidence))
  };
}
