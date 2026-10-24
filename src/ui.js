// 消息与结果卡片的渲染。卡片按动作类型分派，数据全部来自银行核心的返回值。

export function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moneyInt(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('zh-CN');
}

function clock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function cardShell(cls = '') {
  return el('div', `card ${cls}`.trim());
}

function head(title, tagText, tagCls = '') {
  const h = el('div', 'card-head');
  h.appendChild(el('span', 'card-title', title));
  if (tagText) {
    const tag = el('span', `tag ${tagCls}`.trim(), tagText);
    h.appendChild(tag);
  }
  return h;
}

function rows(items) {
  const box = el('div', 'rows');
  for (const [k, v] of items) {
    if (v === undefined || v === null || v === '') continue;
    const row = el('div', 'row');
    row.appendChild(el('span', '', k));
    row.appendChild(el('b', '', String(v)));
    box.appendChild(row);
  }
  return box;
}

function foot(left, right) {
  const f = el('div', 'card-foot');
  f.appendChild(el('span', '', left));
  if (right) f.appendChild(el('span', '', right));
  return f;
}

/* ---------------- 转账回执 ---------------- */
export function transferCard(data) {
  const card = cardShell();
  card.appendChild(head('转账回执', '已受理', ''));
  const amount = el('div', 'amount');
  amount.appendChild(el('span', '', `-${money(data.amount)}`));
  amount.appendChild(el('span', 'unit', '元'));
  card.appendChild(amount);
  card.appendChild(
    rows([
      ['收款人', data.maskedPhone ? `${data.payee} · ${data.maskedPhone}` : data.payee],
      ['手续费', `¥${money(data.fee)}`],
      ['账户余额', `¥${money(data.balanceAfter)}`]
    ])
  );
  card.appendChild(foot(`凭证 ${data.receipt}`, `${clock()} · 已写入审计链`));
  return card;
}

/* ---------------- 账单分析 ---------------- */
export function billCard(data) {
  const card = cardShell();
  card.appendChild(head(`${data.period}支出`, `${data.count} 笔`, 'amber'));
  const amount = el('div', 'amount');
  amount.appendChild(el('span', '', money(data.total)));
  amount.appendChild(el('span', 'unit', '元'));
  card.appendChild(amount);

  if (data.byCategory && data.byCategory.length) {
    const bars = el('div', 'bars');
    const max = Math.max(...data.byCategory.map((c) => c.amount));
    for (const c of data.byCategory.slice(0, 4)) {
      const row = el('div', 'bar-row');
      row.appendChild(el('span', 'name', c.name));
      const track = el('div', 'track');
      const fill = el('i', c.share > 40 ? 'amber' : '');
      fill.style.width = `${Math.max(4, Math.round((c.amount / max) * 100))}%`;
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('span', 'val', `${money(c.amount)}`));
      bars.appendChild(row);
    }
    card.appendChild(bars);
  }

  if (data.anomaly && data.anomaly.length) {
    const flag = el('div', 'flag');
    flag.appendChild(el('span', '', '!'));
    flag.appendChild(
      el('span', '', `${data.anomaly.length} 笔金额明显高于同类日常水平：${data.anomaly.map((a) => `${a.merchant} ${money(a.amount)} 元`).join('、')}`)
    );
    card.appendChild(flag);
  }

  card.appendChild(foot(`日均 ${money(data.averagePerDay)} 元`, `订阅支出 ${money(data.subscriptionTotal)} 元`));
  return card;
}

/* ---------------- 预算 ---------------- */
export function budgetCard(data) {
  const card = cardShell();
  card.appendChild(head('预算执行', data.status, data.status === '超支' ? 'red' : data.status === '偏紧' ? 'amber' : ''));

  const hero = el('div', 'budget-hero');
  const num = el('div', 'budget-num');
  num.appendChild(el('span', '', money(Math.abs(data.remaining))));
  num.appendChild(el('small', '', data.remaining >= 0 ? '元可用' : '元超支'));
  hero.appendChild(num);
  hero.appendChild(el('div', 'card-title', `预算 ${moneyInt(data.budget)} 元`));
  card.appendChild(hero);

  const meter1 = el('div', 'dual-meter');
  const fill1 = el('div', `spent${data.spendProgress > 100 ? ' over' : ''}`);
  fill1.style.width = `${Math.min(100, Math.max(2, data.spendProgress))}%`;
  meter1.appendChild(fill1);
  card.appendChild(meter1);
  const legend1 = el('div', 'meter-legend');
  legend1.appendChild(el('span', '', `预算已用 ${data.spendProgress}%`));
  legend1.appendChild(el('span', '', `剩余 ¥${money(data.remaining)}`));
  card.appendChild(legend1);

  const meter2 = el('div', 'dual-meter');
  const fill2 = el('div', 'spent');
  fill2.style.background = '#c9d3dd';
  fill2.style.width = `${Math.min(100, Math.max(2, data.monthProgress))}%`;
  meter2.appendChild(fill2);
  card.appendChild(meter2);
  const legend2 = el('div', 'meter-legend');
  legend2.appendChild(el('span', '', `时间进度 ${data.monthProgress}%`));
  legend2.appendChild(el('span', '', `本月还剩 ${data.daysLeft} 天`));
  card.appendChild(legend2);

  const stats = el('div', 'stats');
  for (const [label, value] of [
    ['日均可用', `¥${money(data.dailyAllowance)}`],
    ['当月预计', `¥${moneyInt(data.projected)}`],
    ['待扣订阅', `¥${money(data.upcomingTotal)}`]
  ]) {
    const s = el('div', 'stat');
    s.appendChild(el('span', '', label));
    s.appendChild(el('b', '', value));
    stats.appendChild(s);
  }
  card.appendChild(stats);

  if (data.spendProgress > data.monthProgress + 8) {
    const flag = el('div', 'flag');
    flag.appendChild(el('span', '', '!'));
    flag.appendChild(el('span', '', `花钱速度快于时间进度 ${data.spendProgress - data.monthProgress} 个百分点，按当前节奏月底会超预算。`));
    card.appendChild(flag);
  }

  return card;
}

/* ---------------- 订阅清单 ---------------- */
export function subsCard(data) {
  const card = cardShell();
  card.appendChild(head('订阅清单', `${data.count} 项`, 'amber'));
  const amount = el('div', 'amount');
  amount.appendChild(el('span', '', money(data.monthly)));
  amount.appendChild(el('span', 'unit', '元 / 月'));
  card.appendChild(amount);

  const list = el('div', 'sub-list');
  for (const s of data.items) {
    const item = el('div', 'sub-item');
    const left = el('div');
    left.appendChild(el('div', 'sub-name', s.name));
    left.appendChild(el('div', 'sub-meta', `下次扣费 ${s.next}`));
    item.appendChild(left);
    item.appendChild(el('div', 'sub-price', `¥${money(s.amount)}`));
    list.appendChild(item);
  }
  card.appendChild(list);
  card.appendChild(foot(`全年 ${money(data.yearly)} 元`, '点击下方示例可取消其中一项'));
  return card;
}

/* ---------------- 订阅洞察 ---------------- */
export function subInsightCard(data) {
  const card = cardShell();
  card.appendChild(head('订阅体检', `每月 ${money(data.monthly)} 元`, 'amber'));

  if (data.changes && data.changes.length) {
    const list = el('div', 'sub-list');
    for (const c of data.changes) {
      const item = el('div', 'sub-item');
      const left = el('div');
      left.appendChild(el('div', 'sub-name', c.name));
      left.appendChild(el('div', 'sub-meta', `${money(c.from)} 元 → ${money(c.to)} 元，下次 ${c.next}`));
      item.appendChild(left);
      const price = el('div', 'sub-price');
      price.appendChild(el('span', '', `¥${money(c.to)}`));
      price.appendChild(el('span', 'delta', `+${c.pct}%`));
      item.appendChild(price);
      list.appendChild(item);
    }
    card.appendChild(list);
  }

  if (data.duplicates && data.duplicates.length) {
    const dup = el('div', 'dup-box');
    for (const d of data.duplicates) {
      dup.appendChild(
        el('div', '', `${d.category}类有 ${d.items.length} 项重复：${d.items.map((i) => i.name).join('、')}，每月 ${money(d.monthly)} 元`)
      );
    }
    dup.appendChild(el('div', 'sub-meta', `合并可省 ${money(data.savedIfMerged)} 元 / 月`));
    card.appendChild(dup);
  }

  card.appendChild(foot(`${data.count} 项订阅 · 全年 ${money(data.yearly)} 元`, '数据来自近 90 天扣费记录'));
  return card;
}

/* ---------------- 卡片信息 ---------------- */
export function cardsCard(data) {
  const card = cardShell();
  card.appendChild(head('我的卡片', `${data.cards.length} 张`, ''));
  const amount = el('div', 'amount');
  amount.appendChild(el('span', '', money(data.credit.available)));
  amount.appendChild(el('span', 'unit', '元可用额度'));
  card.appendChild(amount);
  card.appendChild(
    rows([
      ['信用卡', data.credit.cardNo],
      ['额度', `¥${moneyInt(data.credit.limit)}`],
      ['已用', `¥${money(data.credit.used)}`],
      ['账单日', `每月 ${data.credit.billDay} 日`]
    ])
  );
  const list = el('div', 'sub-list');
  for (const c of data.cards) {
    const item = el('div', 'sub-item');
    const left = el('div');
    left.appendChild(el('div', 'sub-name', c.type));
    left.appendChild(el('div', 'sub-meta', c.no));
    item.appendChild(left);
    item.appendChild(el('span', `tag ${c.status === '正常' ? '' : 'amber'}`, c.status));
    list.appendChild(item);
  }
  card.appendChild(list);
  return card;
}

/* ---------------- 理财推荐 ---------------- */
export function wealthCard(data) {
  const card = cardShell();
  card.appendChild(head('产品筛选', data.amount ? `按 ${moneyInt(data.amount)} 元` : '全部产品', ''));
  const list = el('div', 'sub-list');
  for (const p of data.products) {
    const item = el('div', 'sub-item');
    const left = el('div');
    left.appendChild(el('div', 'sub-name', p.name));
    left.appendChild(el('div', 'sub-meta', `${p.risk} · ${p.term} · ${p.fit}`));
    item.appendChild(left);
    item.appendChild(el('div', 'sub-price', `${p.yield}%`));
    list.appendChild(item);
  }
  card.appendChild(list);
  card.appendChild(foot('业绩比较基准不代表实际收益', '申购需多因子验证'));
  return card;
}

/* ---------------- 跨场景计划 ---------------- */
export function planCard(nodes) {
  const card = cardShell();
  card.appendChild(head('已编排的计划', `${nodes.length} 个节点`, 'amber'));
  const plan = el('div', 'mini-plan');
  nodes.forEach((node, i) => {
    const step = el('div', 'mini-step');
    const rail = el('div', 'mini-rail');
    rail.appendChild(el('div', 'mini-dot'));
    if (i < nodes.length - 1) rail.appendChild(el('div', 'mini-line'));
    step.appendChild(rail);
    const body = el('div', 'mini-body');
    body.appendChild(el('div', 'mini-title', node.label));
    body.appendChild(el('div', 'mini-sub', node.summary || node.action));
    step.appendChild(body);
    plan.appendChild(step);
  });
  card.appendChild(plan);
  return card;
}

/* ---------------- 拦截 ---------------- */
export function blockedCard(hit) {
  const card = cardShell('blocked');
  const headBox = el('div', 'blocked-head');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6z');
  svg.appendChild(path);
  headBox.appendChild(svg);
  headBox.appendChild(el('span', '', '请求已阻断'));
  card.appendChild(headBox);
  card.appendChild(el('p', '', `命中规则：${hit.category}（${hit.severity === 'high' ? '高危' : '中危'}）。权限由策略表决定，不接受对话内容修改。`));
  const rules = el('div', 'rule-line');
  rules.appendChild(el('span', 'rule-chip', hit.excerpt || '疑似注入'));
  rules.appendChild(el('span', 'rule-chip', '资金零变动'));
  card.appendChild(rules);
  return card;
}

/* ---------------- 通用消息 ---------------- */
export function message(role, content = {}) {
  const wrap = el('div', `msg msg-${role}`);
  const meta = el('div', 'msg-meta');
  meta.appendChild(el('span', 'who', role === 'user' ? '陈默' : '语行'));
  meta.appendChild(el('span', '', content.time || clock()));
  wrap.appendChild(meta);

  if (content.text) {
    wrap.appendChild(el('div', 'bubble', content.text));
  }
  if (content.card) {
    wrap.appendChild(content.card);
  }
  if (content.note) {
    wrap.appendChild(el('div', 'card-foot', content.note));
  }
  return wrap;
}

export function cardFor(action, data, extra) {
  switch (action) {
    case 'transfer.execute':
      return transferCard(data);
    case 'bill.analyze':
      return billCard(data);
    case 'budget.insight':
      return budgetCard(data);
    case 'sub.scan':
      return subsCard(data);
    case 'sub.insight':
      return subInsightCard(data);
    case 'query.cards':
      return cardsCard(data);
    case 'wealth.recommend':
      return wealthCard(data);
    case 'plan.resolve':
    case 'gift.order':
      return extra && extra.nodes ? planCard(extra.nodes) : null;
    default:
      return null;
  }
}
