// 本地性能基线，数字直接用于技术文档，不靠估算。
import { performance } from 'node:perf_hooks';
import { parse } from '../src/nlu.js';
import { buildPlan } from '../src/planner.js';
import { decide } from '../src/risk.js';
import { scanInjection, verifyGrounding } from '../src/guard.js';
import { createBank, createSeed } from '../src/bank.js';
import { Executor } from '../src/executor.js';
import { AuditLog } from '../src/audit.js';

const UTTERANCES = [
  '给王琪转 800，备注聚餐',
  '帮我分析这个月的账单',
  '我有哪些订阅，把健身的取消',
  '帮我安排一下妈妈的生日，预算 1000',
  '给李明转 5000',
  '每月 5 号给李明转 1200'
];

function bench(name, iterations, fn) {
  for (let i = 0; i < Math.min(50, iterations); i++) fn(i);
  const times = [];
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    fn(i);
    times.push(performance.now() - s);
  }
  const total = performance.now() - t0;
  times.sort((a, b) => a - b);
  const avg = total / iterations;
  const p95 = times[Math.floor(iterations * 0.95)];
  console.log(`${name.padEnd(22)} 平均 ${avg.toFixed(4)} ms   P95 ${p95.toFixed(4)} ms   合计 ${total.toFixed(1)} ms / ${iterations} 次`);
  return { avg, p95 };
}

bench('单句意图解析', 3000, (i) => parse(UTTERANCES[i % UTTERANCES.length]));
bench('任务图构建', 3000, (i) => buildPlan(parse(UTTERANCES[i % UTTERANCES.length])));
bench('风险评分决策', 20000, (i) => decide('transfer.execute', { amount: 100 + (i % 6000) }));
bench('注入扫描', 20000, (i) => scanInjection(UTTERANCES[i % UTTERANCES.length]));
bench('数字溯源校验', 20000, (i) => verifyGrounding('已向王琪转账 800.00 元，余额 11686.30 元', { amount: 800, balanceAfter: 11686.3 }));

const t0 = performance.now();
const rounds = 200;
let nodes = 0;
for (let i = 0; i < rounds; i++) {
  const bank = createBank(createSeed(new Date('2026-10-24T10:00:00')));
  const audit = new AuditLog();
  const plan = buildPlan(parse('给王琪转 800，备注聚餐'));
  const exec = new Executor({ bank, audit, hooks: { confirm: async () => ({ ok: true }), verify: async () => ({ ok: true }) } });
  const res = await exec.run(plan);
  nodes += res.results.length;
}
const perRun = (performance.now() - t0) / rounds;
console.log(`完整链路（解析→评分→确认→执行→审计） 平均 ${perRun.toFixed(2)} ms / 次，样本 ${rounds}，共 ${nodes} 个节点`);

const t1 = performance.now();
for (let i = 0; i < 500; i++) {
  const log = new AuditLog();
  await log.add({ action: 'transfer.execute', summary: 'x', result: '成功' });
  await log.add({ action: 'bill.analyze', summary: 'y', result: '成功' });
  await log.verify();
}
console.log(`审计哈希链（2 条写入 + 全链校验） 平均 ${((performance.now() - t1) / 500).toFixed(2)} ms / 次`);
