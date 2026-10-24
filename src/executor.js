// 任务执行器。负责三件事：按档位卡住执行、把每一步写进审计链、失败时按逆序回滚。

import { decide } from './risk.js';
import { TIER_META } from './policy.js';
import { topoOrder } from './planner.js';

function riskContext(bank, node) {
  const params = node.params || {};
  const state = bank.state;
  const contact = state.contacts.find((c) => c.name === params.payee);
  const now = new Date();
  return {
    amount: params.amount,
    payeeName: params.payee,
    payeeIsNew: Boolean(params.payee && !contact),
    hour: now.getHours(),
    txLastHour: state.dailyTransferred > 0 ? 1 : 0,
    dailyTransferred: state.dailyTransferred,
    deviceTrusted: true
  };
}

async function runQueryBalance(bank) {
  const data = bank.balance();
  return { ok: true, data, summary: `活期余额 ${data.demand.toFixed(2)} 元，可用 ${data.available.toFixed(2)} 元` };
}

async function runQueryTransactions(bank, params) {
  const data = bank.listTransactions(params.limit || 5);
  return { ok: true, data, summary: `返回最近 ${data.rows.length} 笔交易，共 ${data.count} 笔` };
}

async function runBill(bank, params) {
  const data = bank.analyzeBills(params.period);
  const top = data.top ? `${data.top.name} ${data.top.amount.toFixed(2)} 元，占比 ${data.top.share}%` : '暂无支出';
  return { ok: true, data, summary: `${data.period}支出 ${data.total.toFixed(2)} 元，最高类目 ${top}` };
}

async function runWealthQuery(bank) {
  const s = bank.state.wealth;
  const data = { product: s.product, principal: s.principal, sevenDayYield: s.sevenDayYield, yesterdayProfit: s.yesterdayProfit };
  return { ok: true, data, summary: `持有 ${s.product} ${s.principal.toFixed(2)} 元，七日年化 ${s.sevenDayYield}%` };
}

async function runTransfer(bank, params) {
  const res = bank.transfer(params);
  if (!res.ok) return { ok: false, error: res.error, retry: true };
  return {
    ok: true,
    data: res,
    summary: `已向 ${res.payee} 转账 ${res.amount.toFixed(2)} 元，凭证 ${res.receipt}`,
    compensate: () => bank.reverseTransfer(res.receipt)
  };
}

async function runScheduleTransfer(bank, params) {
  const res = bank.scheduleTransfer(params);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res, summary: `每月 ${params.day} 日向 ${res.job.payee} 转 ${res.job.amount.toFixed(2)} 元，任务号 ${res.job.id}` };
}

async function runCollectAA(bank, params) {
  const res = bank.collectAA(params);
  return { ok: true, data: res, summary: `向 ${res.people} 人发起 AA 收款，每人 ${res.each.toFixed(2)} 元` };
}

async function runCancelSub(bank, params) {
  const res = bank.cancelSubscription(params.keyword);
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    data: res,
    summary: `已取消《${res.item.name}》，每月省下 ${res.item.amount.toFixed(2)} 元`,
    compensate: () => bank.restoreSubscription(res.item)
  };
}

async function runCardApply(bank) {
  const res = bank.applyVirtualCard();
  return { ok: true, data: res, summary: `已生成虚拟卡 ${res.card.no}，当前状态${res.card.status}` };
}

async function runCardLimit(bank, params) {
  const res = bank.adjustLimit(params.amount);
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    data: res,
    summary: `信用卡额度由 ${res.prev} 元调整为 ${res.next} 元`,
    compensate: () => bank.adjustLimit(res.prev)
  };
}

async function runCardStatus(bank, params, node) {
  const map = { 'card.lock': '已锁定', 'card.unlock': '正常', 'card.reportLoss': '已挂失' };
  const res = bank.setCardStatus(map[node.action], node.action);
  return {
    ok: true,
    data: res,
    summary: `卡片 ${res.cardNo} 由「${res.prev}」变更为「${res.next}」`,
    compensate: () => bank.setCardStatus(res.prev, 'rollback')
  };
}

async function runWealthPurchase(bank, params) {
  const res = bank.purchaseWealth(params.amount, params.product);
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    data: res,
    summary: `申购 ${res.product} ${res.amount.toFixed(2)} 元，确认单 ${res.confirmNo}`,
    compensate: () => bank.redeemWealth(res.amount)
  };
}

async function runWealthRedeem(bank, params) {
  const res = bank.redeemWealth(params.amount);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res, summary: `赎回 ${res.amount.toFixed(2)} 元，${res.arrive}` };
}

async function runSubScan(bank) {
  const data = bank.subscriptions();
  return { ok: true, data, summary: `识别到 ${data.count} 项订阅，每月固定支出 ${data.monthly.toFixed(2)} 元` };
}

async function runRecommend(bank, params) {
  const data = bank.recommendWealth(params.amount);
  return { ok: true, data, summary: `按 ${data.amount || 0} 元额度筛出 ${data.products.length} 只产品` };
}

async function runAssess(bank) {
  const data = bank.riskAssessment();
  return { ok: true, data, summary: `风险等级 ${data.level}，可配置 ${data.matched} 产品` };
}

async function runPlanResolve(bank, params) {
  const data = bank.birthdayPlan(params.budget || 1000);
  return { ok: true, data, summary: `${data.person}（${data.relation}）生日 ${data.birthday}，建议 ${data.orderDate} 送达` };
}

async function runFreeze(bank, params) {
  const res = bank.freezeFunds(params.amount, params.purpose);
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    data: res,
    summary: `冻结 ${params.amount.toFixed(2)} 元用于${params.purpose}，可用余额 ${res.available.toFixed(2)} 元`,
    compensate: () => bank.unfreezeFunds(params.amount)
  };
}

async function runGiftOrder(bank, params, node, plan) {
  const planData = plan && plan.facts ? plan.facts['plan.resolve'] : null;
  const person = planData ? planData.person : '家人';
  const date = planData ? planData.orderDate : '';
  const items = planData ? planData.items : [];
  const total = planData ? planData.totalCost : params.budget;
  const res = bank.scheduleGift({ items, total, date, person });
  return { ok: true, data: res, summary: `已预约 ${date} 送达鲜花与蛋糕，合计 ${total.toFixed(2)} 元` };
}

async function runReminder(bank, params, node, plan) {
  const planData = plan && plan.facts ? plan.facts['plan.resolve'] : null;
  const date = planData ? planData.orderDate : '';
  const res = bank.setReminder({ text: `确认${planData ? planData.person : '家人'}生日礼品配送`, date });
  return { ok: true, data: res, summary: `已设置 ${date} 09:00 的配送确认提醒` };
}

const HANDLERS = {
  'query.balance': (bank) => runQueryBalance(bank),
  'query.transactions': (bank, p) => runQueryTransactions(bank, p),
  'query.cards': async (bank) => ({ ok: true, data: bank.getCards(), summary: '返回卡片与额度信息' }),
  'bill.analyze': (bank, p) => runBill(bank, p),
  'wealth.query': (bank) => runWealthQuery(bank),
  'wealth.recommend': (bank, p) => runRecommend(bank, p),
  'wealth.assess': (bank) => runAssess(bank),
  'sub.scan': (bank) => runSubScan(bank),
  'sub.cancel': (bank, p) => runCancelSub(bank, p),
  'card.apply': (bank) => runCardApply(bank),
  'card.limit': (bank, p) => runCardLimit(bank, p),
  'card.lock': (bank, p, n) => runCardStatus(bank, p, n),
  'card.unlock': (bank, p, n) => runCardStatus(bank, p, n),
  'card.reportLoss': (bank, p, n) => runCardStatus(bank, p, n),
  'wealth.purchase': (bank, p) => runWealthPurchase(bank, p),
  'wealth.redeem': (bank, p) => runWealthRedeem(bank, p),
  'transfer.execute': (bank, p) => runTransfer(bank, p),
  'transfer.schedule': (bank, p) => runScheduleTransfer(bank, p),
  'transfer.collect': (bank, p) => runCollectAA(bank, p),
  'plan.resolve': (bank, p) => runPlanResolve(bank, p),
  'fund.freeze': (bank, p) => runFreeze(bank, p),
  'gift.order': (bank, p, n, plan) => runGiftOrder(bank, p, n, plan),
  'reminder.set': (bank, p, n, plan) => runReminder(bank, p, n, plan)
};

export class Executor {
  constructor({ bank, audit, hooks = {} }) {
    this.bank = bank;
    this.audit = audit;
    this.hooks = hooks;
    this.compensations = [];
    this.facts = {};
  }

  async run(plan) {
    const order = topoOrder(plan.nodes);
    const context = { ...plan, facts: this.facts };
    const results = [];

    for (const node of order) {
      if (this.hooks.signal && this.hooks.signal.aborted) {
        return { ok: false, aborted: true, results, rolledBack: await this.rollback() };
      }

      const risk = decide(node.action, riskContext(this.bank, node));
      node.risk = risk;
      this.hooks.onNode && this.hooks.onNode(node, 'running', risk);

      if (risk.tier === 'red') {
        const check = this.hooks.verify ? await this.hooks.verify(node, risk) : { ok: false };
        if (!check || !check.ok) {
          this.hooks.onNode && this.hooks.onNode(node, 'blocked', risk);
          await this.audit.add({
            actor: 'user', action: node.action, tier: risk.tier, risk: risk.score,
            summary: node.label, result: '强验证未通过，任务终止'
          });
          return { ok: false, failedNode: node, reason: '强验证未通过', results };
        }
        await this.audit.add({
          actor: 'system', action: 'mfa.verify', tier: 'red', risk: risk.score,
          summary: `${node.label} · 多因子认证`, result: '通过'
        });
      }

      if (risk.tier === 'yellow') {
        const confirmed = this.hooks.confirm ? await this.hooks.confirm(node, risk) : { ok: false };
        if (!confirmed || !confirmed.ok) {
          this.hooks.onNode && this.hooks.onNode(node, 'cancelled', risk);
          await this.audit.add({
            actor: 'user', action: node.action, tier: risk.tier, risk: risk.score,
            summary: node.label, result: '用户取消'
          });
          return { ok: false, failedNode: node, reason: '用户取消', results };
        }
        await this.audit.add({
          actor: 'user', action: 'confirm.approve', tier: 'yellow', risk: risk.score,
          summary: `${node.label} · 用户确认`, result: '已确认'
        });
      }

      let outcome;
      try {
        const handler = HANDLERS[node.action];
        if (!handler) throw new Error(`未注册的指令：${node.action}`);
        outcome = await handler(this.bank, node.params || {}, node, context);
      } catch (err) {
        outcome = { ok: false, error: err.message };
      }

      if (!outcome || !outcome.ok) {
        this.hooks.onNode && this.hooks.onNode(node, 'failed', risk, outcome);
        await this.audit.add({
          actor: 'agent', action: node.action, tier: risk.tier, risk: risk.score,
          summary: node.label, result: `失败：${(outcome && outcome.error) || '未知错误'}`
        });
        const rolled = await this.rollback();
        return { ok: false, failedNode: node, reason: (outcome && outcome.error) || '执行失败', results, rolledBack: rolled };
      }

      node.result = outcome;
      this.facts[node.action] = outcome.data;
      if (outcome.compensate) this.compensations.push({ node, compensate: outcome.compensate });
      this.hooks.onNode && this.hooks.onNode(node, 'done', risk, outcome);
      results.push({ node, outcome });

      await this.audit.add({
        actor: 'agent',
        action: node.action,
        tier: risk.tier,
        risk: risk.score,
        summary: outcome.summary,
        result: '成功'
      });
    }

    return { ok: true, results, facts: this.facts };
  }

  async rollback() {
    const done = [];
    while (this.compensations.length) {
      const { node, compensate } = this.compensations.pop();
      try {
        const res = await compensate();
        done.push({ node: node.label, ok: Boolean(res && res.ok) });
        await this.audit.add({
          actor: 'system', action: 'rollback', tier: node.risk ? node.risk.tier : '',
          risk: node.risk ? node.risk.score : null,
          summary: `回滚 ${node.label}`, result: res && res.ok ? '已恢复' : '回滚失败，需人工介入'
        });
      } catch (err) {
        done.push({ node: node.label, ok: false, error: err.message });
      }
    }
    return done;
  }
}

export function describeTier(tier) {
  return TIER_META[tier] || { label: tier };
}
