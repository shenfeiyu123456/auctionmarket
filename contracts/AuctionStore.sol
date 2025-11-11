// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AuctionStore
 * @dev 拍卖存储合约，负责管理拍卖数据和资金
 */
contract AuctionStore {
    // 拍卖结构体
    struct Auction {
        address nftContract;              // NFT合约地址
        uint256 nftId;                    // NFT ID
        address seller;                   // 卖家地址
        uint256 startingPrice;            // 起始价格
        uint256 currentBid;               // 当前最高出价
        address currentBidder;            // 当前最高出价者
        uint256 startTime;                // 开始时间
        uint256 endTime;                  // 结束时间
        bool isActive;                    // 拍卖是否活跃
    }

    // 事件定义
    event Receive(address sender);

    // NFT ID到拍卖的映射
    mapping(uint256 => Auction) public auctions;
    
    // 用户地址到待提现金额的映射
    mapping(address => uint256) public pendingWithdrawals;
    
    // NFT ID到拍卖的映射（用于快速检查拍卖是否存在）
    mapping(uint256 => bool) public auctionExists;
    
    // NFT合约地址到NFT ID列表的映射
    mapping(address => uint256[]) public nftAuctions;
    
    // 合约所有者
    address private _owner;

    constructor() {
        _owner = msg.sender;
    }

    /**
     * @dev 转移ETH
     */
    function transfer(address payable _to, uint256 _amount) public onlyOwner returns(bool) {
        (bool success, ) = _to.call{value: _amount}("");
        return success;
    }

    /**
     * @dev 转移ERC20代币
     */
    function transferToken(IERC20 _token, address _to, uint256 _amount) public onlyOwner returns(bool) {
        return _token.transfer(_to, _amount);
    }

    /**
     * @dev 创建拍卖
     */
    function createAuction(
        address nftContract,
        uint256 nftId,
        address seller,
        uint256 startingPrice,
        uint256 startTime,
        uint256 endTime
    ) public onlyOwner {
        auctions[nftId] = Auction({
            nftContract: nftContract,
            nftId: nftId,
            seller: seller,
            startingPrice: startingPrice,
            currentBid: 0,
            currentBidder: address(0),
            startTime: startTime,
            endTime: endTime,
            isActive: true
        });
        auctionExists[nftId] = true;
        nftAuctions[nftContract].push(nftId);
    }

    /**
     * @dev 获取拍卖基本信息（用于结束拍卖）
     */
    function getAuctionBasicInfo(uint256 nftId) public view returns (
        address nftContract,
        address seller,
        uint256 currentBid,
        address currentBidder,
        bool isActive,
        uint256 endTime
    ) {
        Auction storage auction = auctions[nftId];
        return (
            auction.nftContract,
            auction.seller,
            auction.currentBid,
            auction.currentBidder,
            auction.isActive,
            auction.endTime
        );
    }

    /**
     * @dev 获取拍卖取消信息
     */
    function getAuctionCancelInfo(uint256 nftId) public view returns (
        address nftContract,
        address seller,
        uint256 currentBid,
        bool isActive
    ) {
        Auction storage auction = auctions[nftId];
        return (
            auction.nftContract,
            auction.seller,
            auction.currentBid,
            auction.isActive
        );
    }

    /**
     * @dev 获取拍卖出价信息
     */
    function getAuctionBidInfo(uint256 nftId) public view returns (
        address seller,
        uint256 currentBid,
        uint256 startingPrice,
        uint256 endTime,
        bool isActive
    ) {
        Auction storage auction = auctions[nftId];
        return (
            auction.seller,
            auction.currentBid,
            auction.startingPrice,
            auction.endTime,
            auction.isActive
        );
    }

    /**
     * @dev 更新出价
     */
    function updateBid(uint256 nftId, uint256 amount, address bidder) public onlyOwner {
        auctions[nftId].currentBid = amount;
        auctions[nftId].currentBidder = bidder;
    }

    /**
     * @dev 设置拍卖为非活跃
     */
    function setAuctionInactive(uint256 nftId) public onlyOwner {
        auctions[nftId].isActive = false;
    }

    /**
     * @dev 获取拍卖信息
     */
    function getAuctionInfo(uint256 nftId) public view returns (
        address nftContract,
        uint256 startingPrice,
        uint256 currentBid,
        address currentBidder,
        uint256 startTime,
        uint256 endTime,
        bool isActive
    ) {
        Auction storage auction = auctions[nftId];
        return (
            auction.nftContract,
            auction.startingPrice,
            auction.currentBid,
            auction.currentBidder,
            auction.startTime,
            auction.endTime,
            auction.isActive
        );
    }

    /**
     * @dev 获取待提现金额
     */
    function getPendingWithdrawal(address user) public view returns (uint256) {
        return pendingWithdrawals[user];
    }

    /**
     * @dev 清零待提现金额
     */
    function clearPendingWithdrawal(address user) public onlyOwner {
        pendingWithdrawals[user] = 0;
    }

    /**
     * @dev 增加待提现金额
     */
    function addPendingWithdrawal(address user, uint256 amount) public onlyOwner {
        pendingWithdrawals[user] += amount;
    }

    /**
     * @dev 获取合约所有者
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev 接收ETH
     */
    receive() external payable {
        emit Receive(msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "caller is not the owner");
        _;
    }
}