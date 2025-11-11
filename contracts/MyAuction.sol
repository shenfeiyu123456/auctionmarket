// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./AuctionStore.sol";

/**
 * @title MyAuction
 * @dev 拍卖业务合约，作为业务层处理拍卖逻辑
 */
contract MyAuction is OwnableUpgradeable {
    // 事件定义
    event AuctionCreated(uint256 indexed nftId, address indexed seller, address nftContract, uint256 startingPrice, uint256 endTime);
    event BidPlaced(uint256 indexed nftId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed nftId, address indexed buyer, address indexed seller, uint256 amount, bool isERC20);
    event AuctionCancelled(uint256 indexed nftId, address indexed seller);
    event Withdrawal(address indexed user, uint256 amount);
    event AuctionStoreSet(address indexed storeAddress);
    
    
    // 存储层合约地址
    AuctionStore public auctionStore;
    
    // 存储ETH价格预言机地址
    address public ethPriceFeed;
    
    // 最低出价增量百分比（基于ETH价格，以基点表示，10000 = 100%）
    uint256 public minBidIncrementPercentage;
    
    // 是否使用测试模式（跳过价格预言机调用）
    bool public isTestMode;
    
    // 测试模式下的模拟ETH价格
    uint256 public testEthPrice;
    
    // 初始化函数
    function initialize(address _ethPriceFeed) public initializer {
        __Ownable_init(msg.sender);
        auctionStore = new AuctionStore();
        ethPriceFeed = _ethPriceFeed;
        minBidIncrementPercentage = 500; // 默认5%
        isTestMode = false;
        testEthPrice = 200000000000; // 默认测试价格2000 USD，8位小数
        emit AuctionStoreSet(address(auctionStore));
    }
    
    /**
     * @dev 设置ETH价格预言机地址
     * @param _ethPriceFeed 新的预言机地址
     */
    function setEthPriceFeed(address _ethPriceFeed) public onlyOwner {
        ethPriceFeed = _ethPriceFeed;
    }
    
    
    /**
     * @dev 创建拍卖
     * @param nftContract NFT合约地址
     * @param nftId NFT ID
     * @param startingPrice 起始价格
     * @param duration 拍卖持续时间（秒）
     */
    function createAuction(
        address nftContract,
        uint256 nftId,
        uint256 startingPrice,
        uint256 duration
    ) external {
        require(nftContract != address(0), "Invalid NFT contract address");
        require(startingPrice > 0, "Starting price must be greater than 0");
        require(duration > 0, "Duration must be greater than 0");

        // 检查卖家是否有权限转移NFT
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(nftId) == msg.sender, "You are not the owner of this NFT");
        require(nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(nftId) == address(this), "Contract not approved to transfer NFT");

        // 转移NFT到合约
        nft.transferFrom(msg.sender, address(this), nftId);

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;

        // 通过存储层创建拍卖
        auctionStore.createAuction(
            nftContract,
            nftId,
            msg.sender,
            startingPrice,
            startTime,
            endTime
        );

        emit AuctionCreated(nftId, msg.sender, nftContract, startingPrice, endTime);
    }
    

    
    /**
     * @dev 设置测试模式
     * @param _isTestMode 是否启用测试模式
     * @param _testEthPrice 测试模式下的ETH价格
     */
    function setTestMode(bool _isTestMode, uint256 _testEthPrice) external onlyOwner {
        isTestMode = _isTestMode;
        testEthPrice = _testEthPrice;
    }

    /**
     * @dev 获取ETH当前价格（USD）
     * @return ETH价格（8位小数精度）
     */
    function getEthPrice() public view returns (uint256) {
        // 如果在测试模式下，直接返回测试价格
        if (isTestMode) {
            return testEthPrice;
        }

        // 获取预言机数据
        AggregatorV3Interface priceFeed = AggregatorV3Interface(ethPriceFeed);
        (, int256 price,,,) = priceFeed.latestRoundData();
        
        // 确保价格有效
        require(price > 0, "Invalid price data");
        
        // 返回价格（已验证为正数）
        return uint256(price);
    }

    /**
     * @dev 参与竞拍
     * @param nftId NFT ID
     */
    function placeBid(uint256 nftId) external payable {
        // 获取拍卖信息
        (address seller, uint256 currentBid, uint256 startingPrice, uint256 endTime, bool isActive) = auctionStore.getAuctionBidInfo(nftId);

        require(isActive, "Auction is not active");
        require(block.timestamp < endTime, "Auction has ended");
        require(msg.sender != seller, "Seller cannot bid");
        require(msg.value > 0, "Bid amount must be greater than 0");

        // 使用预言机获取ETH当前价格
        uint256 ethPrice = getEthPrice();
        
        // 将出价金额转换为USD价值
        uint256 bidValueInUSD = (msg.value * ethPrice) / 10**18; // 假设msg.value是wei，转换为ETH后乘以价格
        
        // 检查出价是否有效（基于ETH价格和USD价值）
        if (currentBid == 0) {
            // 首次出价必须达到起始价格
            require(msg.value >= startingPrice, "Bid must be at least starting price");
        } else {
            // 将当前最高出价转换为USD价值
            uint256 currentBidValueInUSD = (currentBid * ethPrice) / 10**18;
            
            // 基于USD价值计算最低出价增量
            uint256 minIncrementInUSD = (currentBidValueInUSD * minBidIncrementPercentage) / 10000;
            uint256 minBidValueInUSD = currentBidValueInUSD + minIncrementInUSD;
            
            // 确保当前出价的USD价值满足最低增量要求
            require(bidValueInUSD >= minBidValueInUSD, "Bid must meet minimum increment in USD value");
        }

        // 更新出价信息
        auctionStore.updateBid(nftId, msg.value, msg.sender);

        emit BidPlaced(nftId, msg.sender, msg.value);
    }
    
    
    // 结束拍卖
    function endAuction(uint256 nftId) external {
        // 获取拍卖基本信息
        (address nftContract, address seller, uint256 currentBid, address currentBidder, bool isActive, uint256 endTime) = auctionStore.getAuctionBasicInfo(nftId);

        require(isActive, "Auction is not active");
        require(block.timestamp >= endTime, "Auction has not ended yet");

        // 通过存储层标记拍卖为非活跃
        auctionStore.setAuctionInactive(nftId);

        // 如果有最高出价者，转移NFT和资金
        if (currentBid > 0 && currentBidder != address(0)) {
            // 转移NFT给最高出价者
            IERC721 nft = IERC721(nftContract);
            nft.transferFrom(address(this), currentBidder, nftId);

            // 将最高出价添加到卖家的待提款
            auctionStore.addPendingWithdrawal(seller, currentBid);
        } else {
            // 如果没有出价者，将NFT返还给卖家
            IERC721 nft = IERC721(nftContract);
            nft.transferFrom(address(this), seller, nftId);
        }

        emit AuctionEnded(nftId, currentBidder, seller, currentBid, false);
    }
    
    // 取消拍卖
    function cancelAuction(uint256 nftId) external {
        // 获取拍卖信息
        (address nftContract, address seller, uint256 currentBid, bool isActive) = auctionStore.getAuctionCancelInfo(nftId);

        require(isActive, "Auction is not active");
        require(msg.sender == seller, "Not the auction seller");
        require(currentBid == 0, "Cannot cancel auction with bids");

        // 通过存储层标记拍卖为非活跃
        auctionStore.setAuctionInactive(nftId);

        // 转移NFT回卖家
        IERC721 nft = IERC721(nftContract);
        nft.transferFrom(address(this), seller, nftId);

        emit AuctionCancelled(nftId, seller);
    }
    
    // 提现
    function withdraw() external {
        uint256 amount = auctionStore.getPendingWithdrawal(msg.sender);
        require(amount > 0, "No funds to withdraw");

        // 通过存储层清零待提款金额
        auctionStore.clearPendingWithdrawal(msg.sender);

        // 发送ETH给用户
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(msg.sender, amount);
    }
    
    /**
     * @dev 获取拍卖详情
     * @param nftId NFT ID
     */
    function getAuctionInfo(uint256 nftId) external view returns (
        address nftContract,
        uint256 nftIdValue,
        address seller,
        uint256 startingPrice,
        uint256 currentBid,
        address currentBidder,
        uint256 startTime,
        uint256 endTime,
        bool isActive
    ) {
        // 从存储层获取基础信息
        (nftContract, startingPrice, currentBid, currentBidder, startTime, endTime, isActive) = auctionStore.getAuctionInfo(nftId);
        // 假设卖家地址是存储层的某个状态变量，这里简化处理
        seller = address(0); // 暂时设置为零地址，实际应该从存储层获取
        nftIdValue = nftId;
        return (nftContract, nftIdValue, seller, startingPrice, currentBid, currentBidder, startTime, endTime, isActive);
    }

    /**
     * @dev 检查拍卖是否处于活跃状态
     */
    function isAuctionActive(uint256 nftId) public view returns (bool) {
        // 直接从存储层获取拍卖状态
        (, , , , , , bool isActive) = auctionStore.getAuctionInfo(nftId);
        return isActive;
    }
    
    // 获取待提现金额
    function getPendingWithdrawal(address user) external view returns (uint256) {
        return auctionStore.pendingWithdrawals(user);
    }
    
    /**
     * @dev 设置最低出价增量百分比
     * @param newPercentage 新的增量百分比（以基点表示，10000 = 100%）
     */
    function setMinBidIncrementPercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage > 0 && newPercentage <= 5000, "Invalid percentage"); // 限制在0.01%到50%
        minBidIncrementPercentage = newPercentage;
    }
    
}

