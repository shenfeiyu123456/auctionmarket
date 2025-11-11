// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MyAuction.sol";
import "./AuctionStore.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

/**
 * @title AuctionFactory
 * @dev 拍卖工厂合约，作为工厂层负责创建和管理拍卖业务合约实例
 */
contract AuctionFactory is OwnableUpgradeable, UUPSUpgradeable {
    // 事件定义
    event AuctionCreated(uint256 indexed nftId, address indexed seller, address indexed nftContract);
    event MyAuctionInstanceCreated(address indexed instance, address indexed creator);
    event MyAuctionCreated(address indexed instanceAddress, address indexed creator);
    
    //竞拍实例
    address public myAuctionBeacon;
    //存储所有创建的实例
    address[] public auctionInstances;
    //有效实例映射
    mapping(address => bool) public isValidInstance;

    
    /**
     * @dev 初始化函数
     */
    function initialize(address _myAuctionBeacon) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        myAuctionBeacon = _myAuctionBeacon;
    }
    
    /**
     * @dev 升级授权函数
     */
    function _authorizeUpgrade(address) internal view override onlyOwner {}
    
    
    /**
     * @dev 创建MyAuction实例
     * @param _ethPriceFeed ETH价格预言机地址
     */
    function createAuction(address _ethPriceFeed) external {
        BeaconProxy auctionInstance = new BeaconProxy(
            myAuctionBeacon,
            abi.encodeWithSelector(
                MyAuction.initialize.selector,
                _ethPriceFeed
            )
        );
        auctionInstances.push(address(auctionInstance));
        isValidInstance[address(auctionInstance)] = true;
        emit MyAuctionInstanceCreated(address(auctionInstance), msg.sender);
    }
    
    /**
     * @dev 获取所有创建的实例数量
     */
    function getInstanceCount() external view returns (uint256) {
        return auctionInstances.length;
    }
    
    
    /**
     * @dev 获取所有创建的实例
     */
    function getAllInstances() external view returns (address[] memory) {
        return auctionInstances;
    }
}