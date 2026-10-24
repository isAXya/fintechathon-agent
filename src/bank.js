// 模拟银行核心。所有金额变动都走这里，UI 不直接改数字。
// 换成真实银行接口时，只需要把这几个方法的实现替换成 HTTP 调用，上层不用动。

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgo(now, n) {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() - n);
  return fmtDate(d);
}

function seedTransactions(now) {
  const rows = [
    [1, '美团外卖', '餐饮', 38.5], [1, '滴滴出行', '交通', 24.2], [2, '星光视频会员', '订阅', 25],
    [2, '盒马鲜生', '日用', 156.8], [3, '星巴克', '餐饮', 41], [4, '京东商城', '购物', 329],
    [5, '地铁通勤', '交通', 6], [6, '云盘存储', '订阅', 12], [7, '海底捞', '餐饮', 268],
    [8, '中国石化', '交通', 300], [9, '网易云音乐', '订阅', 15], [10, '优衣库', '购物', 459],
    [11, '瑞幸咖啡', '餐饮', 19.9], [12, '房租', '居住', 3200], [13, '水电燃气', '居住', 186.4],
    [14, '健身房年卡', '订阅', 199], [15, '永辉超市', '日用', 213.6], [16, '电影票', '娱乐', 98],
    [17, '滴滴出行', '交通', 31.5], [18, '麦当劳', '餐饮', 45], [19, '淘宝', '购物', 178],
    [20, '中国移动', '通信', 99], [21, '便利店', '日用', 32.5], [22, '喜茶', '餐饮', 28],
    [23, '高铁票', '交通', 553], [24, '球场预订', '娱乐', 160], [25, '山姆会员店', '日用', 612.3],
    [26, '咖啡', '餐饮', 22], [27, '苏宁易购', '购物', 899], [28, '燃气充值', '居住', 200],
    [29, '外卖', '餐饮', 47.8], [30, '共享单车', '交通', 4.5],
    [12, '数码专营店', '购物', 2380], [18, '数码配件', '购物', 129]
  ];
  return rows.map((r, i) => ({
    id: `TX${String(9000 - i)}`,
    date: daysAgo(now, r[0]),
    merchant: r[1],
    category: r[2],
    amount: round2(r[3]),
    direction: 'out',
    channel: '手机银行'
  }));
}

export function createSeed(now = new Date()) {
  return {
    user: { name: '陈默', phone: '138****6021', level: '金卡', since: '2021-04' },
    demand: 12486.30,
    wealth: { product: '朝朝盈货币A', principal: 38200.00, sevenDayYield: 1.842, yesterdayProfit: 1.93 },
    credit: { cardNo: '6225 **** **** 4412', limit: 30000, used: 6842.00, billDay: 5, repayDay: 23 },
    frozen: 0,
    contacts: [
      { name: '王琪', phone: '138****3391', tag: '室友', lastDeal: daysAgo(now, 3) },
      { name: '李明', phone: '139****7745', tag: '同事', lastDeal: daysAgo(now, 26) },
      { name: '张岚', phone: '137****2208', tag: '母亲', birthday: '11-08', lastDeal: daysAgo(now, 12) }
    ],
    riskList: ['6222****9910'],
    subscriptions: [
      { id: 'sub_video', name: '星光视频会员', amount: 25, cycle: '月', next: '11-02', cancelable: true },
      { id: 'sub_cloud', name: '云盘存储', amount: 12, cycle: '月', next: '11-06', cancelable: true },
      { id: 'sub_music', name: '网易云音乐', amount: 15, cycle: '月', next: '11-09', cancelable: true },
      { id: 'sub_gym', name: '健身房年卡分期', amount: 199, cycle: '月', next: '11-14', cancelable: true }
    ],
    products: [
      { id: 'p1', name: '朝朝盈货币A', risk: 'R1 低风险', yield: 1.842, min: 0.01, term: '随取随用', lock: 0 },
      { id: 'p2', name: '稳健增利 90 天', risk: 'R2 中低风险', yield: 2.65, min: 1000, term: '90 天', lock: 90 },
      { id: 'p3', name: '短债精选 30 天', risk: 'R2 中低风险', yield: 2.31, min: 100, term: '30 天', lock: 30 }
    ],
    transactions: seedTransactions(now),
    scheduled: [],
    cards: [
      { id: 'card_physical', type: '实体卡', no: '6225 **** **** 4412', status: '正常', channel: '境内外' }
    ],
    dailyTransferred: 0,
    today: fmtDate(now),
    now
  };
}

function pushTx(state, tx) {
  state.transactions.unshift({
    id: `TX${Math.floor(10000 + Math.random() * 89999)}`,
    date: fmtDate(state.now),
    channel: '手机银行',
    direction: 'out',
    ...tx
  });
}

function sumToday(state) {
  const today = fmtDate(state.now);
  return state.transactions
    .filter((t) => t.date === today && t.direction === 'out' && t.category === '转账')
    .reduce((s, t) => s + t.amount, 0);
}

export function createBank(seed = createSeed()) {
  const state = seed;
  state.dailyTransferred = sumToday(state);

  const api = {
    get state() {
      return state;
    },

    overview() {
      return {
        name: state.user.name,
        level: state.user.level,
        demand: round2(state.demand),
        wealth: round2(state.wealth.principal),
        frozen: round2(state.frozen),
        creditAvailable: round2(state.credit.limit - state.credit.used),
        today: state.today
      };
    },

    balance() {
      const available = round2(state.demand - state.frozen);
      return {
        demand: round2(state.demand),
        frozen: round2(state.frozen),
        available,
        wealth: round2(state.wealth.principal),
        total: round2(state.demand + state.wealth.principal),
        asOf: `${state.today} 11:42`
      };
    },

    listTransactions(limit = 5) {
      return {
        count: state.transactions.length,
        rows: state.transactions.slice(0, limit).map((t) => ({
          date: t.date, merchant: t.merchant, category: t.category, amount: t.amount
        }))
      };
    },

    analyzeBills(period = 'thisMonth') {
      const now = state.now;
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const inRange = (t, from, to) => {
        const d = new Date(t.date);
        return d >= from && d < to;
      };

      let rows;
      let label;
      if (period === 'lastMonth') {
        rows = state.transactions.filter((t) => inRange(t, lastMonthStart, monthStart));
        label = '上个月';
      } else if (period === 'quarter') {
        const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        rows = state.transactions.filter((t) => new Date(t.date) >= from);
        label = '近三个月';
      } else {
        rows = state.transactions.filter((t) => inRange(t, monthStart, new Date(now.getTime() + 86400000)));
        label = '本月';
      }

      const total = round2(rows.reduce((s, t) => s + t.amount, 0));
      const bucket = {};
      for (const t of rows) bucket[t.category] = round2((bucket[t.category] || 0) + t.amount);
      const byCategory = Object.keys(bucket)
        .map((k) => ({ name: k, amount: bucket[k], share: total ? Math.round((bucket[k] / total) * 1000) / 10 : 0 }))
        .sort((a, b) => b.amount - a.amount);

      // 异常判定按类目内部比较：房租、话费、通勤这类刚性支出不参与，
      // 同一类目里单笔超过中位数三倍且过 500 元才算异常。
      const FIXED = new Set(['居住', '通信', '交通']);
      const anomaly = [];
      const byCat = {};
      for (const t of rows) {
        (byCat[t.category] = byCat[t.category] || []).push(t.amount);
      }
      for (const t of rows) {
        if (FIXED.has(t.category) || t.amount < 500) continue;
        const peers = byCat[t.category].slice().sort((a, b) => a - b);
        const mid = peers.length % 2
          ? peers[(peers.length - 1) / 2]
          : (peers[peers.length / 2 - 1] + peers[peers.length / 2]) / 2;
        if (t.amount > mid * 3) {
          anomaly.push({ date: t.date, merchant: t.merchant, amount: t.amount, category: t.category });
        }
      }

      const subscriptionTotal = round2(
        rows.filter((t) => t.category === '订阅').reduce((s, t) => s + t.amount, 0)
      );

      return {
        period: label,
        total,
        count: rows.length,
        byCategory,
        top: byCategory[0] || null,
        anomaly,
        subscriptionTotal,
        averagePerDay: round2(total / 30)
      };
    },

    getCards() {
      return {
        cards: state.cards.map((c) => ({ ...c })),
        credit: { ...state.credit, available: round2(state.credit.limit - state.credit.used) }
      };
    },

    applyVirtualCard() {
      const no = `6225 **** **** ${Math.floor(1000 + Math.random() * 8999)}`;
      const card = { id: `card_v_${Date.now()}`, type: '虚拟卡', no, status: '待激活', channel: '仅线上' };
      state.cards.push(card);
      return { card, message: '虚拟卡已生成，可在卡片管理中激活' };
    },

    adjustLimit(nextLimit) {
      const target = Number(nextLimit);
      if (!Number.isFinite(target) || target < 5000 || target > 50000) {
        return { ok: false, error: '额度需在 5,000 至 50,000 元之间' };
      }
      const prev = state.credit.limit;
      state.credit.limit = target;
      return { ok: true, prev, next: target };
    },

    setCardStatus(status, reason) {
      const card = state.cards[0];
      const prev = card.status;
      card.status = status;
      return { ok: true, cardNo: card.no, prev, next: status, reason: reason || '' };
    },

    subscriptions() {
      const monthly = state.subscriptions
        .filter((s) => s.cycle === '月')
        .reduce((s, x) => s + x.amount, 0);
      const yearly = state.subscriptions
        .filter((s) => s.cycle === '年')
        .reduce((s, x) => s + x.amount, 0);
      return {
        items: state.subscriptions.map((s) => ({ ...s })),
        monthly: round2(monthly),
        yearly: round2(yearly),
        count: state.subscriptions.length
      };
    },

    cancelSubscription(keyword) {
      const key = String(keyword || '').trim();
      const idx = state.subscriptions.findIndex((s) => key && (s.name.includes(key) || key.includes(s.name.slice(0, 2))));
      if (idx < 0) return { ok: false, error: `没有找到与"${key}"匹配的订阅` };
      const [item] = state.subscriptions.splice(idx, 1);
      return { ok: true, item, remain: state.subscriptions.length };
    },

    recommendWealth(amount) {
      const value = Number(amount) || 0;
      return {
        amount: value,
        products: state.products.map((p) => ({
          ...p,
          fit: value >= p.min ? '可购买' : `起购 ${p.min} 元`
        }))
      };
    },

    riskAssessment() {
      return {
        level: 'C3 平衡型',
        validUntil: '2027-06-30',
        matched: 'R1-R3',
        basis: '近 12 个月理财持有以货币与短债为主，最大回撤 0.4%'
      };
    },

    purchaseWealth(amount, productName) {
      const value = round2(amount);
      const product = state.products.find((p) => p.name.includes(productName || '朝朝盈')) || state.products[0];
      if (!Number.isFinite(value) || value <= 0) return { ok: false, error: '申购金额不合法' };
      if (value < product.min) return { ok: false, error: `该产品起购金额为 ${product.min} 元` };
      if (state.demand - state.frozen < value) return { ok: false, error: '活期可用余额不足' };
      state.demand = round2(state.demand - value);
      if (product.name === state.wealth.product) {
        state.wealth.principal = round2(state.wealth.principal + value);
      } else {
        state.wealth.principal = round2(state.wealth.principal + value);
      }
      return {
        ok: true,
        product: product.name,
        amount: value,
        confirmNo: `FP${Date.now().toString().slice(-8)}`,
        expectedYield: product.yield
      };
    },

    redeemWealth(amount) {
      const value = round2(amount || state.wealth.principal);
      if (value > state.wealth.principal) return { ok: false, error: '赎回金额超过持仓' };
      state.wealth.principal = round2(state.wealth.principal - value);
      state.demand = round2(state.demand + value);
      return { ok: true, amount: value, arrive: '实时到账', balance: round2(state.demand) };
    },

    transfer({ payee, amount, note }) {
      const value = round2(amount);
      if (!payee) return { ok: false, error: '缺少收款人' };
      if (!Number.isFinite(value) || value <= 0) return { ok: false, error: '金额不合法' };
      if (state.demand - state.frozen < value) return { ok: false, error: '活期可用余额不足' };

      const contact = state.contacts.find((c) => c.name === payee || c.phone === payee);
      state.demand = round2(state.demand - value);
      state.dailyTransferred = round2(state.dailyTransferred + value);
      const receiptId = `T${state.today.replace(/-/g, '')}${String(Math.floor(Math.random() * 9000) + 1000)}`;
      pushTx(state, {
        merchant: contact ? contact.name : payee,
        category: '转账',
        amount: value,
        note: note || '',
        receipt: receiptId
      });
      return {
        ok: true,
        receipt: receiptId,
        payee: contact ? contact.name : payee,
        maskedPhone: contact ? contact.phone : '',
        amount: value,
        fee: 0,
        balanceAfter: round2(state.demand),
        note: note || ''
      };
    },

    reverseTransfer(receipt) {
      const tx = state.transactions.find((t) => t.receipt === receipt);
      if (!tx) return { ok: false, error: '找不到原交易' };
      tx.reversed = true;
      state.demand = round2(state.demand + tx.amount);
      state.dailyTransferred = round2(Math.max(0, state.dailyTransferred - tx.amount));
      return { ok: true, amount: tx.amount, balanceAfter: round2(state.demand) };
    },

    scheduleTransfer({ payee, amount, day, note }) {
      const value = round2(amount);
      if (!day || day < 1 || day > 28) return { ok: false, error: '扣款日需在 1 至 28 号之间' };
      const job = {
        id: `S${Date.now().toString().slice(-6)}`,
        payee,
        amount: value,
        day,
        note: note || '',
        status: '生效中',
        nextRun: `${state.today.slice(0, 7)}-${String(day).padStart(2, '0')}`
      };
      state.scheduled.push(job);
      return { ok: true, job };
    },

    collectAA({ amount, people }) {
      const total = round2(amount);
      const n = Math.max(2, Number(people) || 3);
      const each = round2(total / n);
      return { ok: true, total, people: n, each, expire: '72 小时', channel: '微信 / 手机银行消息' };
    },

    birthdayPlan(budget) {
      const mother = state.contacts.find((c) => c.tag === '母亲') || state.contacts[0];
      const reserve = round2(budget || 1000);
      return {
        person: mother.name,
        relation: mother.tag,
        birthday: `${state.now.getFullYear()}-${mother.birthday || '11-08'}`,
        reserve,
        orderDate: `${state.now.getFullYear()}-11-06`,
        items: [
          { name: '鲜花 · 香槟玫瑰 33 枝', price: 268 },
          { name: '蛋糕 · 6 寸低糖', price: 158 }
        ],
        totalCost: 426,
        source: '活期',
        note: '生日当天无法当面送达，安排在生日前两天送达'
      };
    },

    scheduleGift({ items, total, date, person }) {
      const job = {
        id: `G${Date.now().toString().slice(-6)}`,
        type: 'gift',
        person,
        items,
        amount: round2(total),
        runAt: date,
        status: '已预约',
        channel: '合作商户'
      };
      state.scheduled.push(job);
      return { ok: true, job };
    },

    setReminder({ text, date }) {
      const job = { id: `R${Date.now().toString().slice(-6)}`, type: 'reminder', text, runAt: date, status: '已设置' };
      state.scheduled.push(job);
      return { ok: true, job };
    },

    restoreSubscription(item) {
      state.subscriptions.push(item);
      return { ok: true, count: state.subscriptions.length };
    },

    freezeFunds(amount, purpose) {      const value = round2(amount);
      if (state.demand - state.frozen < value) return { ok: false, error: '可用余额不足，无法冻结' };
      state.frozen = round2(state.frozen + value);
      return { ok: true, frozen: state.frozen, available: round2(state.demand - state.frozen), purpose };
    },

    unfreezeFunds(amount) {
      const value = round2(amount);
      state.frozen = round2(Math.max(0, state.frozen - value));
      return { ok: true, frozen: state.frozen };
    }
  };

  return api;
}
