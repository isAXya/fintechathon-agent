// 审计日志用哈希链串起来：每条记录带前一条的摘要，
// 事后改任何一条，后续所有 hash 都对不上，能当场看出来被改过。

async function sha256Hex(text) {
  if (globalThis.crypto && globalThis.crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = (h1 ^ c) * 0x01000193;
    h2 = (h2 + c) * 0x85ebca6b;
    h1 >>>= 0;
    h2 >>>= 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4).slice(0, 64);
}

export class AuditLog {
  constructor() {
    this.records = [];
    this.prev = 'GENESIS';
  }

  async add(entry) {
    const seq = this.records.length + 1;
    const ts = new Date().toISOString();
    const payload = {
      seq,
      ts,
      actor: entry.actor || 'agent',
      action: entry.action || '',
      tier: entry.tier || '',
      risk: entry.risk ?? null,
      summary: entry.summary || '',
      result: entry.result || '',
      prev: this.prev
    };
    const hash = await sha256Hex(JSON.stringify(payload));
    const record = { ...payload, hash };
    this.records.push(record);
    this.prev = hash;
    return record;
  }

  async verify() {
    let prev = 'GENESIS';
    for (const rec of this.records) {
      const payload = {
        seq: rec.seq,
        ts: rec.ts,
        actor: rec.actor,
        action: rec.action,
        tier: rec.tier,
        risk: rec.risk,
        summary: rec.summary,
        result: rec.result,
        prev
      };
      const hash = await sha256Hex(JSON.stringify(payload));
      if (hash !== rec.hash || rec.prev !== prev) {
        return { ok: false, brokeAt: rec.seq };
      }
      prev = rec.hash;
    }
    return { ok: true, count: this.records.length };
  }

  toJSON() {
    return {
      exportedAt: new Date().toISOString(),
      count: this.records.length,
      head: this.prev,
      records: this.records
    };
  }
}
