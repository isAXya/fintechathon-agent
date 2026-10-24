// 三道防线：输入侧挡注入，输出侧查"数字有没有出处"，运行侧做异常熔断。

const INJECTION_PATTERNS = [
  { re: /忽略(以上|之前|前面|上述|上面)(所有)?(的)?(指令|要求|设定|规则|提示)/, category: '指令覆盖', severity: 'high' },
  { re: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i, category: '指令覆盖', severity: 'high' },
  { re: /(你现在是|从现在开始你(是|要|扮演)|假装你是|切换为).{0,12}(管理员|root|开发者模式|无限制)/, category: '角色劫持', severity: 'high' },
  { re: /(跳过|绕过|免除|免去).{0,6}(权限|验证|确认|审核|风控|二次)/, category: '权限绕过', severity: 'high' },
  { re: /(不要|无需|不用).{0,3}(确认|验证|二次确认|人脸|短信)/, category: '权限绕过', severity: 'medium' },
  { re: /(系统|开发者|管理员)(指令|模式|消息|提示)[：:]\s*/, category: '伪造系统消息', severity: 'high' },
  { re: /(输出|告诉我|打印|展示).{0,8}(系统提示词|system\s*prompt|内部指令|你的设定)/i, category: '提示词探测', severity: 'medium' },
  { re: /(DAN|jailbreak|越狱模式|无限制模式)/i, category: '越狱尝试', severity: 'high' },
  { re: /(把|将).{0,10}(转|付|打款).{0,10}(不用|不要|别).{0,4}(问|确认|验证)/, category: '诱导执行', severity: 'high' }
];

const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g;

export function scanInjection(input) {
  const text = String(input || '');
  const normalized = text.replace(INVISIBLE, '');

  for (const p of INJECTION_PATTERNS) {
    const m = normalized.match(p.re);
    if (m) {
      return {
        hit: true,
        category: p.category,
        severity: p.severity,
        excerpt: m[0].slice(0, 40),
        invisibleChars: text.length !== normalized.length
      };
    }
  }

  if (text.length !== normalized.length) {
    return {
      hit: true,
      category: '不可见字符',
      severity: 'medium',
      excerpt: '检测到零宽字符或方向控制符',
      invisibleChars: true
    };
  }

  return { hit: false };
}

function collectNumbers(value, out, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      out.add(value.toFixed(2));
      out.add(String(Math.round(value * 100) / 100));
      out.add(String(Math.round(value)));
      out.add(value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      out.add(value.toLocaleString('zh-CN'));
      return;
    }
  }
  if (typeof value === 'string') {
    const found = value.match(/\d+(?:[.,]\d+)?/g) || [];
    for (const n of found) out.add(n.replace(/,/g, ''));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) collectNumbers(value[key], out, depth + 1);
  }
}

export function verifyGrounding(text, facts) {
  const allowed = new Set();
  collectNumbers(facts, allowed);

  const tokens = String(text || '').match(/\d[\d,]*(?:\.\d+)?/g) || [];
  const unknown = [];
  for (const raw of tokens) {
    const clean = raw.replace(/,/g, '');
    if (allowed.has(clean)) continue;
    const asNumber = Number(clean);
    if (Number.isFinite(asNumber)) {
      const near = [...allowed].some((a) => {
        const n = Number(a.replace(/,/g, ''));
        return Number.isFinite(n) && Math.abs(n - asNumber) < 0.005;
      });
      if (near) continue;
      // 日期、时间、序号这类小整数放行
      if (Number.isInteger(asNumber) && asNumber <= 31) continue;
    }
    unknown.push(raw);
  }

  return { ok: unknown.length === 0, unknown };
}

export class CircuitBreaker {
  constructor({ maxFailures = 3, lockMs = 10 * 60 * 1000, maxBlocks = 5 } = {}) {
    this.maxFailures = maxFailures;
    this.lockMs = lockMs;
    this.maxBlocks = maxBlocks;
    this.failures = 0;
    this.blocks = 0;
    this.lockedUntil = 0;
    this.events = [];
  }

  isLocked(now = Date.now()) {
    return this.lockedUntil > now;
  }

  remainingMs(now = Date.now()) {
    return Math.max(0, this.lockedUntil - now);
  }

  failure(reason, now = Date.now()) {
    this.failures += 1;
    this.events.push({ ts: now, type: 'failure', reason });
    if (this.failures >= this.maxFailures) {
      this.lockedUntil = now + this.lockMs;
      this.events.push({ ts: now, type: 'lock', reason: `连续 ${this.failures} 次验证失败` });
      return { locked: true, until: this.lockedUntil };
    }
    return { locked: false, failures: this.failures };
  }

  blocked(reason, now = Date.now()) {
    this.blocks += 1;
    this.events.push({ ts: now, type: 'blocked', reason });
    if (this.blocks >= this.maxBlocks) {
      this.lockedUntil = now + this.lockMs;
      this.events.push({ ts: now, type: 'lock', reason: `累计拦截 ${this.blocks} 次可疑输入` });
      return { locked: true, until: this.lockedUntil };
    }
    return { locked: false, blocks: this.blocks };
  }

  success() {
    this.failures = 0;
  }

  reset() {
    this.failures = 0;
    this.blocks = 0;
    this.lockedUntil = 0;
    this.events = [];
  }
}
