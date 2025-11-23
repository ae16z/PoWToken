// ---------------------------
// shareValidator.js
// ---------------------------
import { sha256PackedHex, keccakPackedHex } from './utils/hashing.js';
import { passesTarget } from './utils/difficulty.js';


export function validateShare(algo, challenge, miner, nonce, solution, poolTargetHex) {
// algo: 0=SHA256,1=KECCAK
let digest;
if (algo === 0) {
digest = sha256PackedHex(challenge, miner, BigInt(nonce), BigInt(solution));
} else {
digest = keccakPackedHex(challenge, miner, BigInt(nonce), BigInt(solution));
}
const ok = passesTarget(digest, poolTargetHex);
return { ok, digest };
}
