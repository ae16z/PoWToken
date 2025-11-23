// ---------------------------
// utils/hashing.js
// ---------------------------
import crypto from "crypto";
import { ethers } from "ethers";


export function bigIntTo32Buffer(n) {
let hex = n.toString(16);
if (hex.length % 2) hex = '0' + hex;
const b = Buffer.from(hex, 'hex');
if (b.length > 32) throw new Error('bigint too large');
return Buffer.concat([Buffer.alloc(32 - b.length), b]);
}


export function sha256PackedHex(challengeHex, minerAddress, nonceBigInt, solutionBigInt) {
const challengeBuf = Buffer.from(challengeHex.slice(2), 'hex');
const addrBuf = Buffer.from(minerAddress.slice(2).padStart(40, '0'), 'hex');
const nonceBuf = bigIntTo32Buffer(nonceBigInt);
const solBuf = bigIntTo32Buffer(solutionBigInt);
const buf = Buffer.concat([challengeBuf, addrBuf, nonceBuf, solBuf]);
return '0x' + crypto.createHash('sha256').update(buf).digest('hex');
}


export function keccakPackedHex(challengeHex, minerAddress, nonceBigInt, solutionBigInt) {
return ethers.solidityPackedKeccak256(
["bytes32","address","uint256","uint256"],
[challengeHex, minerAddress, nonceBigInt.toString(), solutionBigInt.toString()]
);
}
