// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MockV3Aggregator
 * @dev 模拟Chainlink V3价格预言机，用于测试环境
 */
contract MockV3Aggregator {
    uint8 public decimals;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80 public roundId;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        answer = _initialAnswer;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        roundId = 1;
    }

    function setAnswer(int256 _answer) external {
        answer = _answer;
        updatedAt = block.timestamp;
        roundId++;
    }

    function latestRoundData() external view returns (
        uint80 roundId_,
        int256 answer_,
        uint256 startedAt_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) {
        return (roundId, answer, startedAt, updatedAt, roundId);
    }
}