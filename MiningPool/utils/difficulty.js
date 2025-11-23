// ---------------------------
// utils/difficulty.js
// ---------------------------
export function hexToBigInt(hex) {
return BigInt(hex);
}


export function passesTarget(digestHex, targetHex) {
return BigInt(digestHex) < BigInt(targetHex);
}


// pool target from pool difficulty (poolDiff is relative scale)
// You can compute poolTarget = globalTarget * (poolDiffRef / poolDiff)
// But simpler: use a supplied pool target (contract target used for final validation).
