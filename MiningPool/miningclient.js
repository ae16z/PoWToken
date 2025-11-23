// ---------------------------
// mining_client_example.js
// ---------------------------
// simple miner example that requests job and tries random solutions
import axios from 'axios';
import { ethers } from 'ethers';


const POOL_URL = process.env.POOL_URL || 'http://localhost:8080';
const MINER = process.env.MINER_ADDR || '0x...';
const ALGO = process.env.ALGO_INDEX ? parseInt(process.env.ALGO_INDEX) : 1;


async function run() {
console.log('miner start');
while(true) {
try {
const r = await axios.post(`${POOL_URL}/getjob`, { address: MINER, algo: ALGO });
const { challenge, target, minerNonce } = r.data;
console.log('got job', { challenge, minerNonce });


// try random solutions until we find one (very naive)
for (let i = 0; i < 1000000; i++) {
const solution = BigInt(Math.floor(Math.random()*Number.MAX_SAFE_INTEGER));
// build digest using ethers packing
const digest = ethers.solidityPackedKeccak256(["bytes32","address","uint256","uint256"],[challenge, MINER, BigInt(minerNonce).toString(), solution.toString()]);
if (BigInt(digest) < BigInt(target)) {
console.log('found solution', solution.toString());
const submit = await axios.post(`${POOL_URL}/submit`, { miner: MINER, algo: ALGO, nonce: minerNonce, solution: solution.toString() });
console.log('submit result', submit.data);
break;
}
}


} catch (err) {
