// India STAX — Shared market data & game logic engine (runs on server)

const DB = {
  repo:       [9.0,8.0,7.0,6.5,6.0,5.5,4.5,4.5,6.0,7.75,5.0,5.75,7.25,8.0,7.5,7.0,6.75,6.25,6.0,5.15,4.0,4.0,4.0,4.0,4.5,6.5,6.5,6.5,6.25,6.0],
  cpi:        [8.0,13.2,3.4,4.0,4.0,3.7,4.3,3.8,8.3,10.9,12.1,8.9,7.4,6.4,5.9,5.4,3.6,3.4,3.7,6.2,6.6,5.1,4.7,5.5,6.7,6.7,5.4,4.8,4.5,4.5],
  gdp:        [4.0,6.2,7.4,5.4,5.6,3.8,8.0,7.9,7.9,8.4,9.3,9.3,6.7,8.4,9.0,8.0,7.1,6.6,6.1,4.0,-5.8,9.1,7.2,8.4,8.2,7.2,6.8,6.5,6.5,6.5],
  sensex:     [3361,3360,5001,3972,3604,2800,3469,5591,9398,13786,14522,20289,9718,17465,20509,17704,19426,26999,27499,28869,41254,48782,59307,60840,72240,79468,62000,65000,70000,78000],
  itc:        [9,10,12,14,17,15,22,38,68,94,130,170,225,178,180,220,240,320,315,196,245,278,350,245,210,358,450,430,470,510],
  hul:        [90,95,105,115,125,110,130,155,185,220,270,240,270,285,310,410,520,650,870,1250,1950,1680,2140,2450,2200,2600,2400,2600,2800,3000],
  mm:         [50,55,70,85,100,80,110,195,440,590,850,520,920,1150,720,580,740,1050,1200,1380,760,680,920,720,1020,1450,1600,1750,1900,2100],
  reliance:   [21,19,45,60,82,75,110,198,612,724,891,1238,472,1003,947,865,877,1050,1201,1445,2369,2368,2458,2823,2894,3012,2800,3100,3300,3500],
  tatamotors: [28,32,40,55,65,45,75,130,350,520,730,280,500,1050,1200,860,920,380,480,520,170,280,490,400,480,950,800,900,1000,1100],
  tatasteel:  [8,7,9,12,15,10,16,38,65,95,185,250,60,185,210,120,135,175,290,320,540,480,430,1100,1600,1480,1200,1400,1600,1800],
  lt:         [40,55,90,145,195,148,220,450,1100,1300,1480,1800,650,1450,1611,1320,1351,1643,1493,1279,1117,1524,1887,2148,3652,3963,3500,3800,4100,4400],
  infy:       [28,51,113,201,345,183,212,521,1380,1484,2155,1788,1229,2729,2800,1120,988,1096,700,827,718,1759,1640,1752,1636,1857,1700,1900,2100,2300],
  hdfcbank:   [35,42,65,90,115,100,145,280,560,680,1020,940,760,1680,2130,1780,1920,2520,2970,3530,5350,5700,4890,6100,7870,8550,7200,8000,8800,9500],
  sunpharma:  [12,15,22,30,42,38,55,95,180,260,380,480,560,490,640,820,1100,980,850,680,510,430,650,570,840,1180,1200,1350,1500,1650],
  tcs:        [null,null,null,null,null,null,null,850,1200,1050,1200,650,1400,2050,1840,1580,1650,2100,2400,2500,2950,3240,2050,3645,4200,3630,3500,3800,4200,4600],
  ntpc:       [null,null,null,null,null,null,null,62,80,115,210,190,175,200,195,145,140,165,140,130,95,115,155,175,225,355,350,380,420,460],
  asianpaints:[18,20,24,28,34,30,40,65,115,165,240,310,380,420,480,560,650,580,1050,1240,2350,1580,3050,2800,3350,3500,3200,3500,3800,4100],
  gold:       [4850,4700,4400,4500,4600,4800,5200,8100,10430,14500,18800,26400,28000,29600,26730,25600,25600,28400,28375,39386,48651,45600,52670,58000,63000,75000,80000,85000,90000,95000],
  oil:        [1100,1200,1400,1350,1300,1250,1650,2500,4200,6100,5600,6400,2800,4600,5200,3650,3400,3650,4100,3900,2800,5200,8100,7200,7800,8500,7000,7500,8000,8500],
  realestate: [600,650,700,800,900,950,1050,1200,1600,2100,2500,3200,2900,3500,3800,3600,3700,4100,4400,4600,4900,5200,5500,6000,6800,7500,7000,7500,8000,8500]
};

const YN = ['1997','1998','1999','2000','2001','2002','2003','2004','2005','2006','2007','2008','2009','2010','2011','2012','2013','2014','2015','2016','2017','2018','2019','2020','2021','2022','2023','2024','2025','2026'];

const SECTOR_SLOTS = [
  { slot: 'Consumer / FMCG', stocks: [
    { id: 'itc', name: 'ITC', sector: 'FMCG', listedIdx: 0 },
    { id: 'hul', name: 'HUL', sector: 'Consumer Goods', listedIdx: 0 },
    { id: 'asianpaints', name: 'Asian Paints', sector: 'Specialty Chem', listedIdx: 0 },
  ]},
  { slot: 'Auto / Engineering', stocks: [
    { id: 'mm', name: 'M&M', sector: 'Auto / Farm', listedIdx: 0 },
    { id: 'tatamotors', name: 'Tata Motors', sector: 'Automobile', listedIdx: 0 },
    { id: 'lt', name: 'L&T', sector: 'Infra / Engg', listedIdx: 0 },
  ]},
  { slot: 'Metals / Energy', stocks: [
    { id: 'tatasteel', name: 'Tata Steel', sector: 'Metals / Steel', listedIdx: 0 },
    { id: 'reliance', name: 'Reliance', sector: 'Energy / Petro', listedIdx: 0 },
    { id: 'ntpc', name: 'NTPC', sector: 'Power / PSU', listedIdx: 7 },
  ]},
  { slot: 'IT / Pharma / Banking', stocks: [
    { id: 'infy', name: 'Infosys', sector: 'IT Services', listedIdx: 0 },
    { id: 'hdfcbank', name: 'HDFC Bank', sector: 'Private Banking', listedIdx: 0 },
    { id: 'sunpharma', name: 'Sun Pharma', sector: 'Pharma', listedIdx: 0 },
    { id: 'tcs', name: 'TCS', sector: 'IT / Software', listedIdx: 7 },
  ]},
];

const CODENAMES = ['Falcon','Orion','Vega','Nova','Titan','Hydra','Cygnus','Pulsar','Atlas','Draco','Lyra','Sirius','Phoenix','Rigel','Altair'];
const UNLOCK_YEARS = [4, 4, 6, 7];

const FIXED_ASSETS = [
  { id: 'savings', nm: 'Savings Acct', grp: 'fixed', ul: 1, safe: true },
  { id: 'fd1', nm: 'FD — 1 Yr', grp: 'fixed', ul: 2, safe: true, fdY: 1 },
  { id: 'fd3', nm: 'FD — 3 Yr', grp: 'fixed', ul: 2, safe: true, fdY: 3 },
  { id: 'fd5', nm: 'FD — 5 Yr', grp: 'fixed', ul: 2, safe: true, fdY: 5 },
  { id: 'sensex', nm: 'Sensex', grp: 'index', ul: 3 },
  { id: 'realestate', nm: 'Real Estate', grp: 'alts', ul: 9 },
  { id: 'gold', nm: 'Gold /10g', grp: 'alts', ul: 10 },
  { id: 'oil', nm: 'Crude Oil', grp: 'alts', ul: 11 },
];

const NEWS_EVENTS = [
  { y: 1, t: 'Markets open. Savings account live. ₹20,000 ready to deploy.' },
  { y: 2, t: 'Fixed deposits unlocked. Lock in rates while repo holds.' },
  { y: 3, t: 'Sensex index fund live. Broad market exposure available.' },
  { y: 4, t: 'Two blind stocks enter the board. Invest on price signals only.' },
  { y: 5, t: 'Macro indicators update biannually. Watch all three signals.' },
  { y: 6, t: 'Third blind stock unlocked.' },
  { y: 7, t: 'Fourth blind stock available. Full equity board now live.' },
  { y: 8, t: 'Halfway through. Reassess your allocation mix.' },
  { y: 9, t: 'Real estate unlocked. Illiquid but historically resilient.' },
  { y: 10, t: 'Gold available. The classic macro hedge. Watch CPI.' },
  { y: 11, t: 'Crude oil futures live. High volatility, macro-sensitive.' },
  { y: 12, t: 'All assets on board. Consider rebalancing.' },
  { y: 15, t: 'Final stretch. Review all P&L positions.' },
  { y: 18, t: 'Endgame approaching. Protect your gains.' },
  { y: 19, t: 'Penultimate year. Last major rebalance window.' },
  { y: 20, t: 'Final year. Game ends at month 12.' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickStartYear() {
  return Math.floor(Math.random() * 11); // 0..10, gives 20-yr window within 1997-2026
}

function pickStocks(startYear) {
  const names = shuffle(CODENAMES);
  const picked = [];
  SECTOR_SLOTS.forEach((slot, si) => {
    const eligible = slot.stocks.filter(s => {
      if (s.listedIdx > startYear) return false;
      const d = DB[s.id];
      if (!d) return false;
      for (let i = startYear; i < startYear + 20; i++) {
        if (d[i] != null) return true;
      }
      return false;
    });
    if (!eligible.length) return;
    const stock = eligible[Math.floor(Math.random() * eligible.length)];
    picked.push({ ...stock, codename: names[si], unlockYear: UNLOCK_YEARS[si] });
  });
  return picked;
}

function buildAssetDefs(pickedStocks) {
  const stockAssets = pickedStocks.map(s => ({
    id: s.id, nm: s.codename, grp: 'stocks', ul: s.unlockYear,
    safe: false, realName: s.name, realSector: s.sector, codename: s.codename
  }));
  return [...FIXED_ASSETS, ...stockAssets];
}

function getPrice(id, startYear, curY, curM) {
  const d = DB[id];
  if (!d) return 0;
  const i = startYear + curY - 1;
  const b = d[i] || 0, nx = d[Math.min(i + 1, d.length - 1)] || b;
  return b + (nx - b) * ((curM - 1) / 12);
}

function prevMoPrice(id, startYear, curY, curM) {
  const d = DB[id];
  if (!d) return getPrice(id, startYear, curY, curM);
  const i = startYear + curY - 1;
  const b = d[i] || 0, nx = d[Math.min(i + 1, d.length - 1)] || b;
  const pm = curM - 2;
  if (pm < 0) {
    const pi = Math.max(0, i - 1);
    const pb = d[pi] || 0, pn = d[Math.min(pi + 1, d.length - 1)] || pb;
    return pb + (pn - pb) * (11 / 12);
  }
  return b + (nx - b) * (pm / 12);
}

function getRate(id, startYear, curY) {
  const i = startYear + curY - 1;
  const r = DB.repo[i] || 6;
  if (id === 'savings') return +(r - 2.5).toFixed(2);
  if (id === 'fd1') return +(r - 1.5).toFixed(2);
  if (id === 'fd3') return +(r - 0.75).toFixed(2);
  if (id === 'fd5') return +(r + 0.25).toFixed(2);
  return r;
}

function buildHist(id, startYear, curY) {
  if (!DB[id]) return [];
  const res = [];
  for (let y = 0; y < Math.min(curY, 20) && (startYear + y) < DB[id].length - 1; y++) {
    const base = DB[id][startYear + y] || 0, next = DB[id][startYear + y + 1] || base;
    for (let m = 0; m < 12; m++) res.push(Math.round(base + (next - base) * (m / 12)));
  }
  return res;
}

// Like buildHist, but includes full PAST years plus only the elapsed months
// of the CURRENT year (up to curM), so the chart line visibly extends every
// month/tick instead of jumping once per year.
function buildHistToMonth(id, startYear, curY, curM) {
  if (!DB[id]) return [];
  const res = [];
  const fullYears = Math.max(0, curY - 1); // years fully completed before this one
  for (let y = 0; y < Math.min(fullYears, 20) && (startYear + y) < DB[id].length - 1; y++) {
    const base = DB[id][startYear + y] || 0, next = DB[id][startYear + y + 1] || base;
    for (let m = 0; m < 12; m++) res.push(Math.round(base + (next - base) * (m / 12)));
  }
  // Partial current year: only months elapsed so far (curM is 1-indexed)
  const yIdx = startYear + fullYears;
  if (yIdx < DB[id].length - 1 && fullYears < 20) {
    const base = DB[id][yIdx] || 0, next = DB[id][Math.min(yIdx + 1, DB[id].length - 1)] || base;
    const monthsElapsed = Math.max(1, Math.min(curM, 12));
    for (let m = 0; m < monthsElapsed; m++) res.push(Math.round(base + (next - base) * (m / 12)));
  }
  return res;
}

module.exports = {
  DB, YN, SECTOR_SLOTS, CODENAMES, UNLOCK_YEARS, FIXED_ASSETS, NEWS_EVENTS,
  shuffle, pickStartYear, pickStocks, buildAssetDefs,
  getPrice, prevMoPrice, getRate, buildHist, buildHistToMonth
};
