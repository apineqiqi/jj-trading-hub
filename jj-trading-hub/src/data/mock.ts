import type { DecisionRule, WatchItem } from '../types/market';

export const watchlist: WatchItem[] = [
  {
    symbol: '688167', name: '炬光科技', price: 284.18, changePct: 1.87, group: 'CPO/激光', score: 7.5,
    state: '观察', support: '280', trigger: '突破并站稳 289', invalidation: '跌回 278 下方',
    note: '273 探底后强势修复，明显跑赢光模块权重。'
  },
  {
    symbol: '688256', name: '寒武纪', price: 1099.99, changePct: -0.72, group: 'AI 芯片', score: 5.5,
    state: '等待确认', support: '1088–1090', trigger: '站稳 1105–1110', invalidation: '有效跌破 1088',
    note: '低点暂时守住，但收盘未完成转强确认。'
  },
  {
    symbol: '688808', name: '联讯仪器', price: 2528.00, changePct: 5.34, group: 'CPO/测试设备', score: 8.0,
    state: '转强', note: '全天维持相对强势，设备/测试方向领涨。'
  },
  {
    symbol: '300757', name: '罗博特科', price: 585.20, changePct: 0.43, group: 'CPO/设备', score: 6.5,
    state: '观察', note: '跟随设备端偏强，但强度弱于联讯。'
  },
  {
    symbol: '300502', name: '新易盛', price: 384.76, changePct: -0.50, group: 'CPO/光模块', score: 5.0,
    state: '防守', note: '光模块核心权重偏弱。'
  },
  {
    symbol: '300308', name: '中际旭创', price: 813.00, changePct: -1.14, group: 'CPO/光模块', score: 4.5,
    state: '防守', note: '午后继续走弱，未形成权重回流。'
  }
];

export const decisions: DecisionRule[] = [
  { id: 'cam-1', stock: '寒武纪', condition: '1088–1090 二次企稳', action: '允许小幅试加，仍需止损和仓位复核', priority: '高' },
  { id: 'cam-2', stock: '寒武纪', condition: '重新站稳 1105–1110', action: '提高主动加仓优先级', priority: '高' },
  { id: 'cam-3', stock: '寒武纪', condition: '有效跌破 1088 且反抽失败', action: '停止主动加仓，只做防守', priority: '高' },
  { id: 'jg-1', stock: '炬光科技', condition: '280 附近回踩不破', action: '观察低吸机会', priority: '高' },
  { id: 'jg-2', stock: '炬光科技', condition: '放量突破并站稳 289', action: '确认短线转强，进入进攻模式', priority: '高' },
  { id: 'jg-3', stock: '炬光科技', condition: '跌回 278 下方', action: '判定修复失败，降低仓位积极度', priority: '高' }
];
