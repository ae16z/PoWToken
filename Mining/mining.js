// mining.js (ethers v6 compatible)
import 'dotenv/config';
import { ethers } from "ethers";
import pkg from "js-sha3";
import crypto from "crypto";

const { keccak256: jsKeccak256 } = pkg; // kept if needed, but we use ethers.solidityPackedKeccak256

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error("Missing env vars. Set RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const abi = [
  // must match your contract
  "function getMiningInfo(uint8 algo) external view returns (uint256 difficultyParam, uint256 target, bool enabled, uint256 minerNonceForCaller, bytes32 challenge, uint256 totalMinted, uint256 nextHalving)",
  "function mine(uint8 algo, uint256 solution) external",
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

// helpers
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// convert bigint -> 32-byte big-endian Buffer
function bigIntTo32Buffer(n) {
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const buf = Buffer.from(hex, 'hex');
  if (buf.length > 32) throw new Error("bigint too large for 32 bytes");
  const padded = Buffer.concat([Buffer.alloc(32 - buf.length), buf]);
  return padded;
}

// pack [bytes32, address, uint256, uint256] and sha256 it (match abi.encodePacked)
function sha256PackedHex(challengeHex, minerAddress, nonceBigInt, solutionBigInt) {
  const challengeBuf = Buffer.from(challengeHex.slice(2), "hex"); // 32 bytes
  const addrBuf = Buffer.from(minerAddress.slice(2).padStart(40, "0"), "hex"); // 20 bytes
  const nonceBuf = bigIntTo32Buffer(nonceBigInt);
  const solBuf = bigIntTo32Buffer(solutionBigInt);
  const buf = Buffer.concat([challengeBuf, addrBuf, nonceBuf, solBuf]);
  const h = crypto.createHash("sha256").update(buf).digest("hex");
  return "0x" + h;
}

// keccak packed using ethers v6 helper (solidityPackedKeccak256)
function keccakPackedHex(challengeHex, minerAddress, nonceBigInt, solutionBigInt) {
  return ethers.solidityPackedKeccak256(
    ["bytes32","address","uint256","uint256"],
    [challengeHex, minerAddress, nonceBigInt.toString(), solutionBigInt.toString()]
  );
}

async function miningLoop(algoIndex = 1) {
  console.log("🔥 Starting PoW miner... algo =", algoIndex);
  const minerAddress = await wallet.getAddress();

  while (true) {
    try {
      // fetch mining info for this miner (get challenge + minerNonce from contract view)
      const info = await contract.getMiningInfo(algoIndex);
      // info: [difficultyParam(BigInt), target(BigInt), enabled(bool), minerNonceForCaller(BigInt), challenge(bytes32), totalMinted(BigInt), nextHalving(BigInt)]
      const targetBig = BigInt(info[1].toString());  // BigInt
      const enabled = info[2];
      const minerNonce = info[3] ? BigInt(info[3].toString()) : 0n;
      const challenge = info[4];

      if (!enabled) {
        console.log("Algorithm disabled. Sleeping...");
        await sleep(5000);
        continue;
      }

      console.log("Challenge:", challenge);
      console.log("Nonce:", minerNonce.toString());
      console.log("Target (hex):", "0x" + targetBig.toString(16));

      let solution = 0n;
      const maxTries = 5_000_000;
      let tries = 0;

      while (true) {
        let digestHex;
        if (algoIndex === 0) {
          digestHex = sha256PackedHex(challenge, minerAddress, minerNonce, solution);
        } else if (algoIndex === 1) {
          digestHex = keccakPackedHex(challenge, minerAddress, minerNonce, solution);
        } else {
          // fallback: mimic contract's fallback keccak salt
          const saltHex = ethers.hexlify(ethers.toUtf8Bytes("BLAKE2FALLBACK"));
          digestHex = keccakPackedHex(saltHex, minerAddress, minerNonce, solution);
        }

        const digestBig = BigInt(digestHex);

        if (digestBig < targetBig) {
          console.log("🎯 FOUND solution:", solution.toString());
          console.log("digest:", digestHex);

          // Submit to chain — we validated off-chain so estimateGas should not revert
          const tx = await contract.mine(algoIndex, solution);
          console.log("⛏️ Submitted tx:", tx.hash);
          await tx.wait();
          console.log("✅ Mined! Waiting a bit before next round.");
          break;
        }

        solution += 1n;
        tries++;
        if ((tries & 0xffff) === 0) process.stdout.write(".");

        if (tries >= maxTries) {
          console.log("\nReached max tries, will refresh challenge/nonce...");
          break;
        }
      }

      await sleep(200);

    } catch (err) {
      // Detailed error logging
      console.error("❌ Mining error:", (err && err.message) ? err.message : err);
      // If it's provider related (missing revert data), wait longer
      await sleep(1000);
    }
  }
}

const algoEnv = process.env.ALGO_INDEX ? parseInt(process.env.ALGO_INDEX) : 1;
miningLoop(algoEnv);
