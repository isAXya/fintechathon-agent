// 大模型只做两件事：兜底识别规则没覆盖的说法、把结构化结果说人话。
// 它拿不到账户余额，也不参与权限判断；返回内容必须过数字校验才能显示。
// 默认关闭，开源环境不配置也能完整演示（规则引擎兜底）。

export const llmConfig = {
  enabled: false,
  endpoint: '',
  apiKey: '',
  model: '',
  timeoutMs: 4000
};

export function configureLLM(patch = {}) {
  Object.assign(llmConfig, patch);
  return { ...llmConfig };
}

const ALLOWED_ACTIONS = new Set([
  'query.balance', 'query.transactions', 'query.cards', 'bill.analyze',
  'wealth.query', 'wealth.recommend', 'wealth.assess', 'wealth.purchase', 'wealth.redeem',
  'transfer.execute', 'transfer.schedule', 'transfer.collect',
  'sub.scan', 'sub.cancel',
  'card.apply', 'card.limit', 'card.lock', 'card.unlock', 'card.reportLoss',
  'plan.compile'
]);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

function validate(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const action = String(payload.action || '');
  if (!ALLOWED_ACTIONS.has(action)) return null;
  const slots = payload.slots && typeof payload.slots === 'object' ? payload.slots : {};
  const safeSlots = {};
  if (Number.isFinite(Number(slots.amount))) safeSlots.amount = Number(slots.amount);
  if (typeof slots.payee === 'string' && slots.payee.length <= 20) safeSlots.payee = slots.payee;
  if (typeof slots.note === 'string' && slots.note.length <= 40) safeSlots.note = slots.note;
  if (Number.isFinite(Number(slots.day))) safeSlots.day = Number(slots.day);
  if (typeof slots.period === 'string') safeSlots.period = slots.period;
  if (typeof slots.template === 'string') safeSlots.template = slots.template;
  if (Number.isFinite(Number(slots.budget))) safeSlots.budget = Number(slots.budget);
  return { action, slots: safeSlots, confidence: 0.72, evidence: '大模型兜底识别' };
}

export async function parseWithLLM(text) {
  if (!llmConfig.enabled || !llmConfig.endpoint) return null;

  const body = {
    model: llmConfig.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '你是银行意图分类器。只输出 JSON：{"action":"...","slots":{}}。' +
          `action 只能取：${[...ALLOWED_ACTIONS].join(', ')}。` +
          '不要输出解释，不要输出金额单位，不要编造用户没说的信息。'
      },
      { role: 'user', content: String(text).slice(0, 200) }
    ]
  };

  try {
    const res = await withTimeout(
      fetch(llmConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify(body)
      }),
      llmConfig.timeoutMs
    );
    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;
    return validate(JSON.parse(content));
  } catch (err) {
    return null;
  }
}

const NUMBER = (n) => Number(n).toFixed(2);
const PERCENT = (n) => String(n);

export function compose(action, data) {
  if (!data) return '';
  switch (action) {
    case 'query.balance':
      return `活期 ${NUMBER(data.demand)} 元，其中冻结 ${NUMBER(data.frozen)} 元，可用 ${NUMBER(data.available)} 元。理财持仓 ${NUMBER(data.wealth)} 元，合计 ${NUMBER(data.total)} 元。数据截至 ${data.asOf}。`;
    case 'query.transactions':
      return data.rows.map((r) => `${r.date} ${r.merchant} ${NUMBER(r.amount)} 元（${r.category}）`).join('\n');
    case 'bill.analyze': {
      const lines = data.byCategory.slice(0, 4).map((c) => `${c.name} ${NUMBER(c.amount)} 元，占 ${PERCENT(c.share)}%`);
      const head = `${data.period}共 ${data.count} 笔支出，合计 ${NUMBER(data.total)} 元。`;
      const anomaly = data.anomaly.length
        ? `\n其中 ${data.anomaly.length} 笔金额明显高于日常水平：${data.anomaly.map((a) => `${a.merchant} ${NUMBER(a.amount)} 元`).join('、')}。`
        : '';
      return `${head}\n${lines.join('\n')}${anomaly}`;
    }
    case 'wealth.query':
      return `持有 ${data.product} ${NUMBER(data.principal)} 元，七日年化 ${PERCENT(data.sevenDayYield)}%，昨日收益 ${NUMBER(data.yesterdayProfit)} 元。`;
    case 'wealth.recommend':
      return data.products.map((p) => `${p.name}（${p.risk}）七日年化 ${PERCENT(p.yield)}%，${p.term}，${p.fit}`).join('\n');
    case 'wealth.assess':
      return `你的风险等级是 ${data.level}，有效期至 ${data.validUntil}，可配置 ${data.matched} 产品。依据：${data.basis}。`;
    case 'wealth.purchase':
      return `已申购 ${data.product} ${NUMBER(data.amount)} 元，确认单 ${data.confirmNo}，业绩比较基准 ${PERCENT(data.expectedYield)}%。`;
    case 'wealth.redeem':
      return `已赎回 ${NUMBER(data.amount)} 元，${data.arrive}，当前活期余额 ${NUMBER(data.balance)} 元。`;
    case 'transfer.execute':
      return `已向 ${data.payee}${data.maskedPhone ? '（' + data.maskedPhone + '）' : ''} 转账 ${NUMBER(data.amount)} 元，凭证号 ${data.receipt}，手续费 ${NUMBER(data.fee)} 元，余额 ${NUMBER(data.balanceAfter)} 元。`;
    case 'transfer.schedule':
      return `已创建定时转账：每月 ${data.job.day} 日向 ${data.job.payee} 转 ${NUMBER(data.job.amount)} 元，下次执行 ${data.job.nextRun}。`;
    case 'transfer.collect':
      return `已发起 AA 收款：总额 ${NUMBER(data.total)} 元，${data.people} 人每人 ${NUMBER(data.each)} 元，${data.expire}内有效。`;
    case 'sub.scan':
      return `识别到 ${data.count} 项订阅，每月固定扣 ${NUMBER(data.monthly)} 元。\n` +
        data.items.map((s) => `${s.name} ${NUMBER(s.amount)} 元/${s.cycle}，下次扣费 ${s.next}`).join('\n');
    case 'sub.cancel':
      return `已取消《${data.item.name}》，每月少支出 ${NUMBER(data.item.amount)} 元，剩余 ${data.remain} 项订阅。`;
    case 'card.apply':
      return `虚拟卡已生成，卡号 ${data.card.no}，当前状态${data.card.status}，可用于线上支付。`;
    case 'card.limit':
      return `信用卡额度已从 ${data.prev} 元调整为 ${data.next} 元。`;
    case 'card.lock':
    case 'card.unlock':
    case 'card.reportLoss':
      return `卡片 ${data.cardNo} 已由「${data.prev}」变更为「${data.next}」。`;
    case 'query.cards':
      return `你有 ${data.cards.length} 张卡。信用卡额度 ${data.credit.limit} 元，已用 ${NUMBER(data.credit.used)} 元，可用 ${NUMBER(data.credit.available)} 元，账单日每月 ${data.credit.billDay} 日。`;
    case 'plan.resolve':
      return `${data.person}（${data.relation}）的生日是 ${data.birthday}。建议 ${data.orderDate} 送达，礼品合计 ${NUMBER(data.totalCost)} 元，从活期冻结 ${NUMBER(data.reserve)} 元专款。`;
    case 'fund.freeze':
      return `已冻结 ${NUMBER(data.frozen)} 元，可用余额 ${NUMBER(data.available)} 元。`;
    case 'gift.order':
      return `已预约 ${data.job.runAt} 向${data.job.person}送达礼品，合计 ${NUMBER(data.job.amount)} 元，预约号 ${data.job.id}。`;
    case 'reminder.set':
      return `已设置 ${data.job.runAt} 09:00 的提醒：${data.job.text}。`;
    default:
      return '';
  }
}

export function safeReply(action, data, fallback) {
  const text = compose(action, data);
  return text || fallback || '操作已完成。';
}
