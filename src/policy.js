// 权限策略表：每个操作有一个"下限档位"，风险评分只能把它往上抬，不能往下压。
// 这样即使模型判断失误，也不会出现"大额转账被自动放行"的情况。

export const TIERS = ['green', 'yellow', 'red'];

export const TIER_META = {
  green: { label: '绿色 · 自动执行', short: '绿色', desc: '纯查询类，确认意图后直接执行' },
  yellow: { label: '黄色 · 用户确认', short: '黄色', desc: '执行前展示明细，需本人点击确认' },
  red: { label: '红色 · 强验证', short: '红色', desc: '需短信验证码 / 人脸 / U 盾多因子认证' }
};

export const ACTIONS = {
  'query.balance': { label: '账户余额查询', floor: 'green' },
  'query.transactions': { label: '交易明细查询', floor: 'green' },
  'query.cards': { label: '卡片信息查询', floor: 'green' },
  'bill.analyze': { label: '账单分析', floor: 'green' },
  'wealth.query': { label: '理财持仓查询', floor: 'green' },
  'wealth.recommend': { label: '理财产品推荐', floor: 'green' },
  'wealth.assess': { label: '风险承受能力测评', floor: 'green' },
  'sub.scan': { label: '订阅扣费扫描', floor: 'green' },
  'sub.insight': { label: '订阅异常检测', floor: 'green' },
  'budget.insight': { label: '预算与可支配额度测算', floor: 'green' },
  'transfer.execute': { label: '转账', floor: 'yellow', reversible: true },
  'transfer.schedule': { label: '定时转账设置', floor: 'yellow', reversible: true },
  'transfer.collect': { label: 'AA 收款', floor: 'yellow' },
  'sub.cancel': { label: '取消订阅', floor: 'yellow' },
  'card.apply': { label: '申请虚拟卡', floor: 'yellow' },
  'card.limit': { label: '信用卡额度调整', floor: 'red' },
  'card.lock': { label: '卡片锁定', floor: 'red' },
  'card.unlock': { label: '卡片解锁', floor: 'red' },
  'card.reportLoss': { label: '卡片挂失', floor: 'red' },
  'wealth.purchase': { label: '理财产品申购', floor: 'red' },
  'wealth.redeem': { label: '理财赎回', floor: 'yellow' },
  'plan.compile': { label: '跨场景计划编排', floor: 'yellow' },
  'plan.resolve': { label: '查询联系人与纪念日', floor: 'green' },
  'fund.freeze': { label: '冻结专项款', floor: 'yellow' },
  'gift.order': { label: '预约礼品配送', floor: 'yellow' },
  'reminder.set': { label: '设置提醒', floor: 'green' }
};

export const ACTION_LIST = Object.keys(ACTIONS);

export function tierRank(tier) {
  const i = TIERS.indexOf(tier);
  return i < 0 ? 0 : i;
}

export function maxTier(a, b) {
  return tierRank(a) >= tierRank(b) ? a : b;
}

export function floorOf(action) {
  const item = ACTIONS[action];
  return item ? item.floor : 'red';
}

export function labelOf(action) {
  const item = ACTIONS[action];
  return item ? item.label : action;
}
