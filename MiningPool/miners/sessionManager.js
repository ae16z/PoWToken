## Miner Session Handler (sessionManager.js)
```javascript
// sessionManager.js
// Track active miner sessions: difficulty, last seen, shares, jobs


export class SessionManager {
constructor() {
this.sessions = new Map(); // minerAddr → session
}


createOrUpdate(minerAddr, ip) {
const now = Date.now();
if (!this.sessions.has(minerAddr)) {
this.sessions.set(minerAddr, {
miner: minerAddr,
ip,
connectedAt: now,
lastSeen: now,
sharesAccepted: 0,
sharesRejected: 0,
currentJob: null,
});
} else {
const s = this.sessions.get(minerAddr);
s.lastSeen = now;
s.ip = ip;
}
return this.sessions.get(minerAddr);
}


assignJob(minerAddr, job) {
if (!this.sessions.has(minerAddr)) return;
const s = this.sessions.get(minerAddr);
s.currentJob = job;
}


reportShare(minerAddr, accepted) {
if (!this.sessions.has(minerAddr)) return;
const s = this.sessions.get(minerAddr);
if (accepted) s.sharesAccepted++;
else s.sharesRejected++;
}


get(minerAddr) {
return this.sessions.get(minerAddr) || null;
}


cleanup(timeoutMs = 60000) {
const now = Date.now();
for (const [addr, sess] of this.sessions.entries()) {
if (now - sess.lastSeen > timeoutMs) {
this.sessions.delete(addr);
}
}
}
}
```
