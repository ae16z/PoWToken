// ---------------------------
// server.js
// ---------------------------
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { refreshJobs, getJobFor } from './jobManager.js';
import { validateShare } from './shareValidator.js';
import { contract, wallet } from './utils/web3.js';


dotenv.config();
const app = express();
app.use(bodyParser.json());


const PORT = process.env.PORT || 8080;
const POOL_DIFF = parseInt(process.env.POOL_DIFFICULTY || '60000');
const POOL_FEE = parseFloat(process.env.POOL_FEE || '1');


// minimal in-memory db
const miners = {}; // miner -> { shares }


// refresh jobs every 10s
setInterval(refreshJobs, 10000);
refreshJobs();


app.post('/getjob', async (req, res) => {
const { address, algo } = req.body;
if (!address || algo === undefined) return res.status(400).json({ error: 'missing params' });
const job = getJobFor(algo, address);
if (!job) return res.status(500).json({ error: 'no job' });


// get minerNonce specifically for caller
const info = await contract.getMiningInfo(algo);
const minerNonce = info[3];


// poolTarget: for pool we allow easier target = contract target * (some factor)
// here we approximate by contract target (miners can use pool share diff client-side)
res.json({
challenge: job.challenge,
target: job.target,
minerNonce: minerNonce
});
});


app.post('/submit', async (req, res) => {
const { miner, algo, nonce, solution } = req.body;
if (!miner || algo === undefined || nonce === undefined || solution === undefined) return res.status(400).json({ error: 'missing params' });


// Use contract target as final on-chain check for acceptance; pool can be more lenient earlier
const info = await contract.getMiningInfo(algo);
const contractTarget = info[1];
const challenge = info[4];


const { ok, digest } = validateShare(algo, challenge, miner, nonce, solution, contractTarget);
if (!ok) {
return res.status(400).json({ status: 'rejected', digest });
}


// share is valid for on-chain; submit mineOnBehalf
try {
const tx = await contract.mineOnBehalf(miner, algo, solution);
const receipt = await tx.wait();


// credit miner shares
});
