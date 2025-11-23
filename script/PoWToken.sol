// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * PoWToken - Ownerless, multi-algo, auto-balancing reward (OPS 3)
 *
 * - MiningConfig holds difficultyParam (human-friendly, higher = harder) and precomputed target.
 * - Reward is dynamic: reward = baseReward * difficultyParam / difficultyReference
 * - baseReward is halved at each halving step (nextHalvingAt). Also difficultyParam is doubled (2x harder).
 * - Verification: uint256(hash) < target
 * - No owner (ownerless). Uses ReentrancyGuard for safety on external mutation functions.
 */
contract PoWToken is ERC20, ReentrancyGuard {
    enum Algorithm { SHA256, KECCAK256, BLAKE2FALLBACK }

    struct MiningConfig {
        uint256 difficultyParam;
        uint256 target;
        bool enabled;
    }

    mapping(Algorithm => MiningConfig) public miningConfigs;
    mapping(address => uint256) public minerNonce;
    mapping(address => address) public poolOperatorOf;
    mapping(address => bool) public payoutToPool;

    bytes32 public currentChallenge;

    uint256 public constant MAX_SUPPLY = 150_000_000e18;
    uint256 public constant HALVING_STEP = 15_000_000e18;
    uint256 public nextHalvingAt = HALVING_STEP;

    uint256 public baseReward;

    uint256 public difficultyReference;

    event ChallengeUpdated(bytes32 newChallenge);
    event Mined(address indexed miner, address indexed mintedTo, Algorithm algo, uint256 reward, uint256 difficultyParam);
    event Halving(uint256 newNextHalvingAt, uint256 newBaseReward);
    event PoolOperatorSet(address indexed miner, address indexed operator, bool payToPool);
    event ShareSubmitted(address indexed submitter, address indexed miner, Algorithm algo, bytes32 shareHash, bool accepted);

    constructor() ERC20("PoWToken", "PoW") {
        baseReward = 500e18;

        difficultyReference = 500000;

        currentChallenge = keccak256(abi.encodePacked(block.timestamp, blockhash(block.number - 1)));

        _setDifficultyParam(Algorithm.SHA256, 500000, true);
        _setDifficultyParam(Algorithm.KECCAK256, 600000, true);
        _setDifficultyParam(Algorithm.BLAKE2FALLBACK, 800000, false);

        _mint(msg.sender, 0);
    }


    function setPoolOperator(address operator, bool payToPool) external nonReentrant {
        poolOperatorOf[msg.sender] = operator;
        payoutToPool[msg.sender] = payToPool;
        emit PoolOperatorSet(msg.sender, operator, payToPool);
    }

    function mine(Algorithm algo, uint256 solution) external nonReentrant {
        _mineInternal(algo, msg.sender, msg.sender, solution);
    }

    function mineOnBehalf(address miner, Algorithm algo, uint256 solution) external nonReentrant {
        require(poolOperatorOf[miner] == msg.sender, "Not authorized pool operator");
        address payTo = payoutToPool[miner] ? msg.sender : miner;
        _mineInternal(algo, miner, payTo, solution);
    }

    function submitShare(address miner, Algorithm algo, uint256 solution) external {
        MiningConfig storage cfg = miningConfigs[algo];
        bytes32 shareHash = _hash(algo, currentChallenge, miner, minerNonce[miner], solution);
        bool accepted = uint256(shareHash) < cfg.target;
        emit ShareSubmitted(msg.sender, miner, algo, shareHash, accepted);
    }


    function _mineInternal(Algorithm algo, address miner, address payTo, uint256 solution) internal {
        MiningConfig storage cfg = miningConfigs[algo];
        require(cfg.enabled, "Algo disabled");

        uint256 nonce = minerNonce[miner];
        bytes32 h = _hash(algo, currentChallenge, miner, nonce, solution);

        bool valid = uint256(h) < cfg.target;
        emit ShareSubmitted(msg.sender, miner, algo, h, valid);
        require(valid, "Invalid PoW");

        uint256 reward = (baseReward * cfg.difficultyParam) / difficultyReference;

        uint256 supply = totalSupply();
        require(supply < MAX_SUPPLY, "Max supply reached");

        if (supply + reward > MAX_SUPPLY) {
            reward = MAX_SUPPLY - supply;
        }

        _mint(payTo, reward);
        emit Mined(miner, payTo, algo, reward, cfg.difficultyParam);

        minerNonce[miner] = nonce + 1;
        _updateChallenge(miner);

        _maybeHalving();
    }


    function _hash(
        Algorithm algo,
        bytes32 challenge,
        address miner,
        uint256 nonce,
        uint256 solution
    ) internal pure returns (bytes32) {
        if (algo == Algorithm.SHA256) {
            return sha256(abi.encodePacked(challenge, miner, nonce, solution));
        } else if (algo == Algorithm.KECCAK256) {
            return keccak256(abi.encodePacked(challenge, miner, nonce, solution));
        } else {
            return keccak256(abi.encodePacked("BLAKE2FALLBACK", challenge, miner, nonce, solution));
        }
    }

    function _updateChallenge(address actor) internal {
        currentChallenge = keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp, actor, currentChallenge));
        emit ChallengeUpdated(currentChallenge);
    }


    function _maybeHalving() internal {
        uint256 supply = totalSupply();
        if (supply >= nextHalvingAt && nextHalvingAt <= MAX_SUPPLY) {

            if (baseReward > 1) {
                baseReward = baseReward / 2;
            } else {
                baseReward = 0;
            }

            for (uint8 i = 0; i < 3; i++) {
                Algorithm algo = Algorithm(i);
                MiningConfig storage c = miningConfigs[algo];
                if (c.difficultyParam > 0) {
                    c.difficultyParam = c.difficultyParam * 2;
                    if (c.difficultyParam == 0) {
                        c.target = 0;
                    } else {
                        c.target = type(uint256).max / c.difficultyParam;
                    }
                }
            }

            nextHalvingAt += HALVING_STEP;
            emit Halving(nextHalvingAt, baseReward);
        }
    }


    function _setDifficultyParam(Algorithm algo, uint256 difficultyParam, bool enabled) internal {
        require(difficultyParam > 0, "bad difficultyParam");
        miningConfigs[algo].difficultyParam = difficultyParam;
        miningConfigs[algo].target = type(uint256).max / difficultyParam;
        miningConfigs[algo].enabled = enabled;
    }


    function getGlobals() external view returns (uint256 _baseReward, uint256 _difficultyReference, uint256 _totalMinted, uint256 _nextHalving, bytes32 _challenge) {
        return (baseReward, difficultyReference, totalSupply(), nextHalvingAt, currentChallenge);
    }

    function getMiningInfo(Algorithm algo) external view returns (
        uint256 difficultyParam,
        uint256 target,
        bool enabled,
        uint256 minerNonceForCaller,
        bytes32 challenge,
        uint256 totalMinted,
        uint256 nextHalving
    ) {
        MiningConfig storage c = miningConfigs[algo];
        return (c.difficultyParam, c.target, c.enabled, minerNonce[msg.sender], currentChallenge, totalSupply(), nextHalvingAt);
    }
}
