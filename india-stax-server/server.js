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

// ---- In-memory room store ----
// rooms[code] = {
//   hostSocketId, code,
//   teams: { teamName: { socketId, cash, holdings, fds, costBasis, joinedAt } },
//   status: 'lobby' | 'running' | 'ended',
//   startYear, curY, curM, secInYear, pickedStocks, ASSETS, tickInterval, newsLog
// }
const rooms = {};

function randCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function fmt(n) {
  n = Math.round(n);
  return n;
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
    secInYear: room.secInYear,
    ASSETS: room.ASSETS,
    newsLog: room.newsLog,
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
      snap[a.id] = {
        price,
        prevPrice,
        unlocked: room.curY >= a.ul,
        hist: room.curY >= a.ul ? md.buildHist(a.id, room.startYear, room.curY) : []
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
  io.to(room.code).emit('tick', {
    curY: room.curY,
    curM: room.curM,
    secInYear: room.secInYear,
    macro: macroFor(room),
    prices: priceSnapshot(room),
    teams: publicTeamsList(room)
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
      if (room.curY === 20 && room.curM > 12) {
        endGame(room);
        return;
      }
      if (room.curM > 12) {
        room.curM = 1;
        room.secInYear = 0;
        advanceYear(room);
      }
    }
    broadcastTick(room);
  }, 1000);
}

function endGame(room) {
  clearInterval(room.tickInterval);
  room.status = 'ended';
  const startYr = md.YN[room.startYear];
  const endYr = md.YN[room.startYear + 19];
  const bench = 20000 * 40 * (md.DB.sensex[room.startYear + 19] / md.DB.sensex[room.startYear]);
  const finalTeams = publicTeamsList(room).map(t => ({
    ...t,
    vsBenchmark: ((t.wealth - bench) / bench * 100)
  }));
  io.to(room.code).emit('gameOver', {
    periodLabel: startYr + ' – ' + endYr,
    stocks: room.pickedStocks.map(s => ({ codename: s.codename, name: s.name, sector: s.sector })),
    teams: finalTeams
  });
}

// ---- Socket handlers ----
io.on('connection', (socket) => {

  socket.on('hostCreate', ({ hostName }, cb) => {
    let code = randCode();
    while (rooms[code]) code = randCode();
    rooms[code] = {
      code, hostSocketId: socket.id, hostName,
      teams: {},
      status: 'lobby',
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
    if (Object.keys(room.teams).length >= 15 && !room.teams[teamName]) {
      return cb({ ok: false, error: 'Room full (15 teams max)' });
    }
    if (room.teams[teamName]) {
      // Reconnect existing team
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
    room.status = 'running';
    room.newsLog = [];

    Object.values(room.teams).forEach(t => {
      t.cash = 20000; t.holdings = {}; t.fds = []; t.costBasis = {};
      room.ASSETS.forEach(a => t.holdings[a.id] = 0);
    });

    io.to(code).emit('gameStarted', publicGameState(room));
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
      // Host left — keep room alive for a grace period in case of refresh
    } else if (socket.data.teamName && room.teams[socket.data.teamName]) {
      room.teams[socket.data.teamName].socketId = null;
      io.to(room.hostSocketId).emit('teamsUpdate', publicTeamsList(room));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('India STAX server running on port ' + PORT));
