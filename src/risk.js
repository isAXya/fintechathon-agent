// 风险评分：把"金额 + 关系 + 时间 + 频次 + 设备 + 收款方名单"折算成 0-100 分，
// 分数决定基础档位；再与策略下限、硬规则取最大值，得到最终档位。

import { floorOf, maxTier } from './policy.js';

const AMOUNT_BANDS = [
  { max: 0, points: 0 },
  { max: 200, points: 0 },
  { max: 1000, points: 14 },
  { max: 5000, points: 32 },
  { max: 20000, points: 52 },
  { max: Infinity, points: 60 }
];

function amountPoints(amount) {
  const value = Number(amount) || 0;
  for (const band of AMOUNT_BANDS) {
    if (value <= band.max) return band.points;
  }
  return 60;
}

function tierFromScore(score) {
  if (score >= 65) return 'red';
  if (score >= 30) return 'yellow';
  return 'green';
}

export function scoreRisk(action, ctx = {}) {
  const reasons = [];
  let score = 0;

  const amount = Number(ctx.amount) || 0;
  const amountScore = amountPoints(amount);
  if (amountScore > 0) {
    score += amountScore;
    reasons.push(`金额 ${formatMoney(amount)} 元，金额档位 +${amountScore}`);
  } else if (amount > 0) {
    reasons.push(`金额 ${formatMoney(amount)} 元，处于低额区间，不加分`);
  }

  if (ctx.payeeIsNew) {
    score += 18;
    reasons.push('收款方不在近 90 天交易记录中，首次往来 +18');
  } else if (ctx.payeeName) {
    reasons.push(`收款方 ${ctx.payeeName} 为历史往来对象，不加分`);
  }

  const hour = Number.isFinite(ctx.hour) ? ctx.hour : 10;
  if (hour >= 22 || hour < 6) {
    score += 8;
    reasons.push(`操作时间 ${String(hour).padStart(2, '0')}:00 处于夜间时段 +8`);
  }

  if ((ctx.txLastHour || 0) >= 3) {
    score += 10;
    reasons.push(`近一小时已发起 ${ctx.txLastHour} 笔操作，频次异常 +10`);
  }

  if (ctx.deviceTrusted === false) {
    score += 9;
    reasons.push('当前设备首次登录，设备可信度低 +9');
  }

  if (ctx.recipientRisk) {
    score += 45;
    reasons.push('收款方命中内部风险名单 +45');
  }

  score = Math.min(100, score);
  return { score, tier: tierFromScore(score), reasons };
}

export function decide(action, ctx = {}) {
  const base = scoreRisk(action, ctx);
  const floor = floorOf(action);
  const escalations = [];

  const amount = Number(ctx.amount) || 0;
  const daily = Number(ctx.dailyTransferred) || 0;

  if (action === 'transfer.execute' || action === 'transfer.schedule') {
    if (amount > 1000) {
      escalations.push(`单笔 ${formatMoney(amount)} 元超过 1000 元，按赛题要求强制进入红色档`);
    } else if (daily + amount > 1000) {
      escalations.push(`当日累计将达 ${formatMoney(daily + amount)} 元，超过 1000 元免确认额度，强制进入红色档`);
    }
  }

  let tier = maxTier(base.tier, floor);
  if (escalations.length) tier = 'red';

  return {
    score: base.score,
    tier,
    policyFloor: floor,
    reasons: base.reasons,
    escalations,
    amount
  };
}

export function formatMoney(n) {
  const value = Number(n) || 0;
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
