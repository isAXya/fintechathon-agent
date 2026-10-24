// 把识别出的意图编排成任务图。节点之间用 deps 表达先后，
// 只读节点互不阻塞，写操作串行，避免同一笔钱被两条分支同时扣。

import { labelOf, floorOf } from './policy.js';

const READ_ACTIONS = new Set([
  'query.balance',
  'query.transactions',
  'query.cards',
  'bill.analyze',
  'wealth.query',
  'wealth.recommend',
  'wealth.assess',
  'sub.scan',
  'plan.resolve'
]);

let seq = 0;
function nextId(prefix = 'n') {
  seq += 1;
  return `${prefix}${seq}`;
}

export function buildPlan(parsed, ctx = {}) {
  const nodes = [];
  let lastWrite = null;
  const blocked = [];

  for (const intent of parsed.intents) {
    if (intent.missing && intent.missing.length) {
      blocked.push({ action: intent.action, labels: intent.missingLabels, clause: intent.clause });
      continue;
    }

    if (intent.action === 'plan.compile') {
      const plan = compileBirthday(intent);
      for (const node of plan) {
        nodes.push(node);
        lastWrite = node.id;
      }
      continue;
    }

    const isRead = READ_ACTIONS.has(intent.action);
    const deps = isRead ? [] : lastWrite ? [lastWrite] : [];
    const node = {
      id: nextId(),
      action: intent.action,
      label: labelOf(intent.action),
      params: { ...intent.slots },
      deps,
      floor: floorOf(intent.action),
      source: intent.clause
    };
    nodes.push(node);
    if (!isRead) lastWrite = node.id;
  }

  if (ctx.planOnly === false) {
    // 预留：真实环境里可以在这里做资源冲突检测
  }

  return {
    nodes,
    blocked,
    canRun: nodes.length > 0 && blocked.length === 0,
    createdAt: new Date().toISOString()
  };
}

function compileBirthday(intent) {
  const budget = intent.slots.budget || 1000;
  const n1 = {
    id: nextId('b'),
    action: 'plan.resolve',
    label: '查询联系人与生日信息',
    params: { contact: '母亲' },
    deps: [],
    floor: 'green',
    source: intent.clause
  };
  const n2 = {
    id: nextId('b'),
    action: 'fund.freeze',
    label: `冻结 ${budget} 元专项款`,
    params: { amount: budget, purpose: '生日礼遇' },
    deps: [n1.id],
    floor: 'yellow',
    source: intent.clause
  };
  const n3 = {
    id: nextId('b'),
    action: 'gift.order',
    label: '预约鲜花与蛋糕',
    params: { budget, amount: budget, leadDays: 2 },
    deps: [n2.id],
    floor: 'yellow',
    source: intent.clause
  };
  const n4 = {
    id: nextId('b'),
    action: 'reminder.set',
    label: '设置送达提醒',
    params: { leadDays: 2 },
    deps: [n3.id],
    floor: 'green',
    source: intent.clause
  };
  return [n1, n2, n3, n4];
}

export function topoOrder(nodes) {
  const done = new Set();
  const order = [];
  let guard = 0;
  while (order.length < nodes.length && guard < nodes.length * nodes.length + 10) {
    guard += 1;
    for (const node of nodes) {
      if (done.has(node.id)) continue;
      const ready = (node.deps || []).every((d) => done.has(d));
      if (ready) {
        order.push(node);
        done.add(node.id);
      }
    }
  }
  return order;
}
