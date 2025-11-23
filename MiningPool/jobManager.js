// ---------------------------
// jobManager.js
// ---------------------------
import { contract } from './utils/web3.js';


// job cache
let jobs = {
// algo -> { challenge, target }
};


export async function refreshJobs() {
try {
// refresh for each algo 0..2
for (let a = 0; a < 3; a++) {
const info = await contract.getMiningInfo(a);
// info: difficultyParam, target, enabled, minerNonceForCaller, challenge
jobs[a] = {
challenge: info[4],
target: info[1],
enabled: info[2]
};
}
} catch (err) {
console.error('jobManager refresh error', err.message || err);
}
}


export function getJobFor(algo, minerAddr) {
const j = jobs[algo];
if (!j) return null;
// minerNonce should be taken from getMiningInfo per-miner; but pool can supply challenge+target
return {
challenge: j.challenge,
target: j.target
};
}
