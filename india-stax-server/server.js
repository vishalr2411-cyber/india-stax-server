// India STAX — Real-time multiplayer server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const md = require('./marketData');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function randCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function fmt(n) { return Math.round(n); }

// Base price at game start (for indexing to 100)
function getBasePrice(id, startYear) {
  const d = md.DB[id];
  if (!d) return 1;
  return d[startYear] || 1;
}

// Convert actual price to indexed value (base 100 at game start)
function toIndex(price, basePrice) {
  return Math.round((price / basePrice) * 100 * 100) / 100;
}

function netWorthFor(room, team) {
  let t = team.cash + (team.holdings.savings || 0);
  team.fds.forEach(f => t += f.amt);
  room.ASSETS.filter(a => !a.safe).forEach(a => {
    t += (team.holdings[a.id] || 0) * md.getPrice(a.id, room.startYear, room.curY, room.curM);
  });
  return t;
}

function publicTeamsList(room) {
  return Object.entries(room.teams).map(([name, t]) => ({
    name,
    wealth: netWorthFor(room, t),
    connected: !!t.socketId
  })).sort((a, b) => b.wealth - a.wealth);
}

function publicGameState(room) {
  return {
    code: room.code,
    status: room.status,
    startYear: room.startYear,
    curY: room.curY,
    curM: room.curM,
    ASSETS: room.ASSETS,
    teams: publicTeamsList(room)
  };
}

function macroFor(room) {
  const i = room.startYear + room.curY - 1;
  return {
    repo: md.DB.repo[i] || 6,
    prevRepo: md.DB.repo[Math.max(0, i - 1)] || 6,
    cpi: md.DB.cpi[i] || 5,
    prevCpi: md.DB.cpi[Math.max(0, i - 1)] || 5,
    gdp: md.DB.gdp[i] || 6,
    prevGdp: md.DB.gdp[Math.max(0, i - 1)] || 6,
  };
}

function priceSnapshot(room) {
  const snap = {};
  room.ASSETS.forEach(a => {
    if (a.safe) {
      snap[a.id] = { rate: md.getRate(a.id, room.startYear, room.curY) };
    } else {
      const price = md.getPrice(a.id, room.startYear, room.curY, room.curM);
      const prevPrice = md.prevMoPrice(a.id, room.startYear, room.curY, room.curM);
      const basePrice = getBasePrice(a.id, room.startYear);
      const rawHist = room.curY >= a.ul ? md.buildHistToMonth(a.id, room.startYear, room.curY, room.curM) : [];
      // Convert hist to index values
      const indexHist = rawHist.map(p => Math.round((p / basePrice) * 100 * 100) / 100);
      snap[a.id] = {
        price: toIndex(price, basePrice),
        prevPrice: toIndex(prevPrice, basePrice),
        rawPrice: price, // kept for cost-basis calc on server only
        unlocked: room.curY >= a.ul,
        hist: indexHist
      };
    }
  });
  return snap;
}

function addNews(room, text) {
  room.newsLog.unshift({ y: room.curY, t: text });
  if (room.newsLog.length > 16) room.newsLog.pop();
  io.to(room.code).emit('news', { y: room.curY, t: text });
}

function applyInterest(room) {
  Object.values(room.teams).forEach(team => {
    const sr = md.getRate('savings', room.startYear, room.curY) / 100 / 12;
    team.holdings.savings = (team.holdings.savings || 0) * (1 + sr);
    team.fds.forEach(f => {
      const r = md.getRate(f.type, room.startYear, room.curY) / 100 / 12;
      f.amt *= (1 + r);
      f.left--;
      if (f.left <= 0) {
        team.cash += f.amt;
        if (team.socketId) io.to(team.socketId).emit('notif', { msg: 'FD matured! +' + Math.round(f.amt), type: 'g' });
      }
    });
    team.fds = team.fds.filter(f => f.left > 0);
  });
}

function broadcastTick(room) {
  const basePayload = {
    curY: room.curY,
    curM: room.curM,
    secInYear: room.secInYear,
    macro: macroFor(room),
    prices: priceSnapshot(room),
    teams: publicTeamsList(room)
  };
  if (room.hostSocketId) io.to(room.hostSocketId).emit('tick', basePayload);
  Object.entries(room.teams).forEach(([name, team]) => {
    if (!team.socketId) return;
    io.to(team.socketId).emit('tick', {
      ...basePayload,
      myCash: team.cash,
      myHoldings: team.holdings,
      myFds: team.fds,
      myNetWorth: netWorthFor(room, team)
    });
  });
}

function advanceYear(room) {
  room.curY++;
  const ev = md.NEWS_EVENTS.find(n => n.y === room.curY);
  if (ev) addNews(room, ev.t);
  const justUnlocked = room.ASSETS.filter(a => a.ul === room.curY);
  justUnlocked.forEach(a => {
    addNews(room, a.nm + ' is now available to trade.');
    io.to(room.code).emit('unlock', { id: a.id, nm: a.nm });
  });
}

function startTicker(room) {
  room.secInYear = 0;
  clearInterval(room.tickInterval);
  room.tickInterval = setInterval(() => {
    room.secInYear++;
    if (room.secInYear % 5 === 0) {
      room.curM++;
      applyInterest(room);
      room.nextCash--;
      if (room.nextCash <= 0) {
        Object.values(room.teams).forEach(t => t.cash += 20000);
        room.nextCash = 6;
        addNews(room, 'Biannual inflow — ₹20,000 credited to every team.');
      }
      if (room.curY === 20 && room.curM > 12) { endGame(room); return; }
      if (room.curM > 12) { room.curM = 1; room.secInYear = 0; advanceYear(room); }
    }
    broadcastTick(room);
  }, 1000);
}

function buildTeamSummary(room, team) {
  const assets = room.ASSETS;
  const summary = [];
  let totalInvested = 0;

  // Savings
  const savBal = team.holdings.savings || 0;
  if (savBal > 0) {
    summary.push({ label: 'Savings Account', group: 'Fixed Income', invested: savBal, currentVal: savBal, pnl: 0 });
    totalInvested += savBal;
  }

  // FDs
  ['fd1','fd3','fd5'].forEach(fdId => {
    const myFds = team.fds.filter(f => f.type === fdId);
    const tot = myFds.reduce((s, f) => s + f.amt, 0);
    const a = assets.find(x => x.id === fdId);
    if (tot > 0 && a) {
      summary.push({ label: a.nm, group: 'Fixed Income', invested: tot, currentVal: tot, pnl: 0 });
      totalInvested += tot;
    }
  });

  // Market assets
  assets.filter(a => !a.safe).forEach(a => {
    const units = team.holdings[a.id] || 0;
    if (units <= 0) return;
    const currentPrice = md.getPrice(a.id, room.startYear, room.curY, room.curM);
    const currentVal = units * currentPrice;
    const costBasis = team.costBasis[a.id] || currentPrice;
    const invested = units * costBasis;
    const pnl = currentVal - invested;
    const group = a.grp === 'index' ? 'Index' : a.grp === 'stocks' ? 'Equities' : 'Alternatives';
    summary.push({ label: a.nm, group, invested, currentVal, pnl, pnlPct: (pnl / invested) * 100 });
    totalInvested += invested;
  });

  // Group allocation %
  const groups = {};
  summary.forEach(s => {
    groups[s.group] = (groups[s.group] || 0) + s.currentVal;
  });
  const totalVal = netWorthFor(room, team);
  Object.keys(groups).forEach(g => { groups[g] = Math.round((groups[g] / totalVal) * 100); });

  return { items: summary, totalInvested, totalVal, allocation: groups };
}

function endGame(room) {
  clearInterval(room.tickInterval);
  room.status = 'ended';
  const startYr = md.YN[room.startYear];
  const endYr = md.YN[room.startYear + 19];
  const bench = 20000 * 40 * (md.DB.sensex[room.startYear + 19] / md.DB.sensex[room.startYear]);

  const finalTeams = publicTeamsList(room).map(t => ({
    ...t,
    vsBenchmark: ((t.wealth - bench) / bench * 100),
    allocation: buildTeamSummary(room, room.teams[t.name]).allocation
  }));

  // Send each team their own personal summary
  Object.entries(room.teams).forEach(([name, team]) => {
    if (!team.socketId) return;
    const summary = buildTeamSummary(room, team);
    const myRank = finalTeams.findIndex(t => t.name === name) + 1;
    io.to(team.socketId).emit('gameOver', {
      periodLabel: startYr + ' – ' + endYr,
      stocks: room.pickedStocks.map(s => ({ codename: s.codename, name: s.name, sector: s.sector })),
      teams: finalTeams,
      isHost: false,
      mySummary: summary,
      myRank,
      totalTeams: finalTeams.length
    });
  });

  // Send host the full cross-team breakdown
  if (room.hostSocketId) {
    io.to(room.hostSocketId).emit('gameOver', {
      periodLabel: startYr + ' – ' + endYr,
      stocks: room.pickedStocks.map(s => ({ codename: s.codename, name: s.name, sector: s.sector })),
      teams: finalTeams,
      isHost: true,
      teamSummaries: Object.entries(room.teams).map(([name, team]) => ({
        name,
        ...buildTeamSummary(room, team)
      }))
    });
  }
}

// ---- Socket handlers ----
io.on('connection', (socket) => {

  socket.on('hostCreate', ({ hostName }, cb) => {
    let code = randCode();
    while (rooms[code]) code = randCode();
    rooms[code] = {
      code, hostSocketId: socket.id, hostName,
      teams: {}, status: 'lobby',
      startYear: 0, curY: 1, curM: 1, secInYear: 0, nextCash: 6,
      pickedStocks: [], ASSETS: [], newsLog: [], tickInterval: null
    };
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.isHost = true;
    cb({ ok: true, code });
  });

  socket.on('teamJoin', ({ code, teamName }, cb) => {
    code = (code || '').toUpperCase();
    const room = rooms[code];
    if (!room) return cb({ ok: false, error: 'Room not found' });
    if (room.status !== 'lobby') return cb({ ok: false, error: 'Game already started' });
    if (Object.keys(room.teams).length >= 15 && !room.teams[teamName])
      return cb({ ok: false, error: 'Room full (15 teams max)' });
    if (room.teams[teamName]) {
      room.teams[teamName].socketId = socket.id;
    } else {
      room.teams[teamName] = {
        socketId: socket.id, cash: 20000, holdings: {}, fds: [], costBasis: {}, joinedAt: Date.now()
      };
    }
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.teamName = teamName;
    socket.data.isHost = false;
    io.to(room.hostSocketId).emit('teamsUpdate', publicTeamsList(room));
    cb({ ok: true });
  });

  socket.on('startGame', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || socket.id !== room.hostSocketId) return;
    if (!Object.keys(room.teams).length) return;
    room.startYear = md.pickStartYear();
    room.pickedStocks = md.pickStocks(room.startYear);
    room.ASSETS = md.buildAssetDefs(room.pickedStocks);
    room.curY = 1; room.curM = 1; room.nextCash = 6;
    room.status = 'running'; room.newsLog = [];
    Object.values(room.teams).forEach(t => {
      t.cash = 20000; t.holdings = {}; t.fds = []; t.costBasis = {};
      room.ASSETS.forEach(a => t.holdings[a.id] = 0);
    });
    const baseState = publicGameState(room);
    if (room.hostSocketId) io.to(room.hostSocketId).emit('gameStarted', baseState);
    Object.entries(room.teams).forEach(([name, team]) => {
      if (!team.socketId) return;
      io.to(team.socketId).emit('gameStarted', { ...baseState, myCash: team.cash, myHoldings: team.holdings, myFds: team.fds });
    });
    addNews(room, 'Markets open. Stocks are blind — read prices and macro only.');
    startTicker(room);
  });

  socket.on('trade', ({ assetId, mode, amount }, cb) => {
    const code = socket.data.roomCode;
    const teamName = socket.data.teamName;
    const room = rooms[code];
    if (!room || !teamName || !room.teams[teamName]) return cb && cb({ ok: false });
    const team = room.teams[teamName];
    const a = room.ASSETS.find(x => x.id === assetId);
    if (!a || room.curY < a.ul) return cb && cb({ ok: false, error: 'Locked' });
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return cb && cb({ ok: false, error: 'Invalid amount' });
    if (mode === 'buy') {
      if (amt > team.cash + 0.01) return cb && cb({ ok: false, error: 'Not enough cash' });
      team.cash -= amt;
      if (assetId === 'savings') {
        team.holdings.savings = (team.holdings.savings || 0) + amt;
      } else if (assetId.startsWith('fd')) {
        team.fds.push({ type: assetId, amt, left: a.fdY * 12 });
      } else {
        const price = md.getPrice(assetId, room.startYear, room.curY, room.curM);
        const units = amt / price;
        const prevUnits = team.holdings[assetId] || 0;
        const prevCost = team.costBasis[assetId] || price;
        team.costBasis[assetId] = (prevUnits * prevCost + units * price) / (prevUnits + units);
        team.holdings[assetId] = prevUnits + units;
      }
    } else {
      if (assetId === 'savings') {
        const w = Math.min(amt, team.holdings.savings || 0);
        team.holdings.savings -= w; team.cash += w;
      } else if (assetId.startsWith('fd')) {
        const fds = team.fds.filter(f => f.type === assetId);
        if (!fds.length) return cb && cb({ ok: false, error: 'No FD active' });
        const fd = fds[fds.length - 1];
        const pay = fd.amt * 0.95;
        team.fds = team.fds.filter(f => f !== fd);
        team.cash += pay;
      } else {
        const price = md.getPrice(assetId, room.startYear, room.curY, room.curM);
        const maxU = team.holdings[assetId] || 0;
        const needU = amt / price;
        if (needU > maxU + 0.001) return cb && cb({ ok: false, error: 'Not enough units' });
        const sellU = Math.min(needU, maxU);
        team.holdings[assetId] -= sellU;
        team.cash += sellU * price;
      }
    }
    cb && cb({ ok: true, cash: team.cash, holdings: team.holdings, fds: team.fds, netWorth: netWorthFor(room, team) });
  });

  socket.on('breakFD', ({ fdType }, cb) => {
    const code = socket.data.roomCode;
    const teamName = socket.data.teamName;
    const room = rooms[code];
    if (!room || !teamName) return cb && cb({ ok: false });
    const team = room.teams[teamName];
    const fds = team.fds.filter(f => f.type === fdType);
    if (!fds.length) return cb && cb({ ok: false, error: 'No FD to break' });
    const fd = fds[fds.length - 1];
    const pay = fd.amt * 0.95;
    team.fds = team.fds.filter(f => f !== fd);
    team.cash += pay;
    cb && cb({ ok: true, cash: team.cash, fds: team.fds });
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;
    if (socket.data.isHost && room.hostSocketId === socket.id) {
      // grace period
    } else if (socket.data.teamName && room.teams[socket.data.teamName]) {
      room.teams[socket.data.teamName].socketId = null;
      if (room.hostSocketId) io.to(room.hostSocketId).emit('teamsUpdate', publicTeamsList(room));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('India STAX server running on port ' + PORT));
