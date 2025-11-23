// ---------------------------
// utils/web3.js
// ---------------------------
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();


const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;


if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
console.error("Missing .env config. Copy .env.example -> .env and set values.");
}


const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);


// Minimal ABI required for pool
const abi = [
"function getMiningInfo(uint8 algo) external view returns (uint256 difficultyParam, uint256 target, bool enabled, uint256 minerNonceForCaller, bytes32 challenge, uint256 totalMinted, uint256 nextHalving)",
"function mineOnBehalf(address miner, uint8 algo, uint256 solution) external",
"function setPoolOperator(address operator, bool payToPool) external"
];


const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);


export { provider, wallet, contract, ethers };
