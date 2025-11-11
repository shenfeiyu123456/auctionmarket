const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("拍卖市场功能性测试", function () {
  let deployer, seller, bidder1, bidder2;
  let myAuctionImpl, myAuctionBeacon, auctionFactoryProxy;
  let myNFTContract;
  let auctionInstance;
  let nftId = 1;
  
  // 部署所有合约
  beforeEach(async function () {
    // 获取测试账户
    [deployer, seller, bidder1, bidder2] = await ethers.getSigners();
    console.log("测试账户:", {
      deployer: deployer.address,
      seller: seller.address,
      bidder1: bidder1.address,
      bidder2: bidder2.address
    });

    // 部署模拟的价格预言机合约
    const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
    const mockPriceFeed = await MockPriceFeed.deploy(8, 200000000000); // 8位小数，价格为2000 USD
    await mockPriceFeed.waitForDeployment();
    const mockPriceFeedAddress = await mockPriceFeed.getAddress();
    console.log("🔮 模拟价格预言机已部署，地址:", mockPriceFeedAddress);

    // 部署MyAuction实现合约
    const MyAuction = await ethers.getContractFactory("MyAuction");
    myAuctionImpl = await MyAuction.deploy();
    await myAuctionImpl.waitForDeployment();
    const myAuctionImplAddress = await myAuctionImpl.getAddress();
    console.log("🔨 MyAuction实现合约已部署，地址:", myAuctionImplAddress);

    // 部署MyAuctionBeacon合约
    const MyAuctionBeacon = await ethers.getContractFactory("MyAuctionBeacon");
    myAuctionBeacon = await MyAuctionBeacon.deploy(myAuctionImplAddress);
    await myAuctionBeacon.waitForDeployment();
    const beaconAddress = await myAuctionBeacon.getAddress();
    console.log("🔨 MyAuctionBeacon已部署，地址:", beaconAddress);

    // 部署AuctionFactory代理合约
    const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
    auctionFactoryProxy = await upgrades.deployProxy(AuctionFactory, [beaconAddress], {
      initializer: 'initialize',
      kind: 'uups'
    });
    await auctionFactoryProxy.waitForDeployment();
    const factoryAddress = await auctionFactoryProxy.getAddress();
    console.log("🔨 AuctionFactory代理合约已部署，地址:", factoryAddress);

    // 部署MyNFT合约
    const MyNFT = await ethers.getContractFactory("MyNFT");
    myNFTContract = await MyNFT.connect(deployer).deploy();
    await myNFTContract.waitForDeployment();
    const nftAddress = await myNFTContract.getAddress();
    console.log("🎨 MyNFT合约地址:", nftAddress);

    // 铸造NFT给卖家
    const mintTx = await myNFTContract.connect(deployer).mintNFT(seller.address, "https://example.com/nft/1");
      await mintTx.wait();
      console.log("✨ NFT铸造成功，ID:", nftId);
  });

  // 测试1: 创建拍卖实例
  describe("创建拍卖实例功能", function () {
    it("应该成功创建拍卖实例", async function () {
      // 使用卖家创建拍卖实例
      console.log("🚀 开始创建拍卖实例...");
      const createAuctionTx = await auctionFactoryProxy.connect(seller).createAuction(mockPriceFeedAddress);
      await createAuctionTx.wait();
      console.log("✅ 拍卖实例创建交易已确认");
      
      // 获取实例数量
      const instanceCount = await auctionFactoryProxy.getInstanceCount();
      console.log(`📊 实例数量: ${instanceCount}`);
      expect(instanceCount).to.equal(1);
      
      // 获取创建的拍卖实例地址
      const instanceAddress = await auctionFactoryProxy.auctionInstances(0);
      console.log("🏗️  创建的拍卖实例地址:", instanceAddress);
      expect(instanceAddress).to.be.properAddress;
      
      // 验证实例是否有效
      const isValid = await auctionFactoryProxy.isValidInstance(instanceAddress);
      expect(isValid).to.be.true;
      
      // 保存拍卖实例以便后续测试
      const MyAuction = await ethers.getContractFactory("MyAuction");
      auctionInstance = MyAuction.attach(instanceAddress);
    });
  });

  // 测试2: 创建NFT拍卖
  describe("创建NFT拍卖功能", function () {
    beforeEach(async function () {
      // 创建拍卖实例
      const createAuctionTx = await auctionFactoryProxy.connect(seller).createAuction(mockPriceFeedAddress);
      await createAuctionTx.wait();
      const instanceAddress = await auctionFactoryProxy.auctionInstances(0);
      auctionInstance = await ethers.getContractAt("MyAuction", instanceAddress);
      
      // 启用测试模式，避免调用真实预言机
      await auctionInstance.connect(seller).setTestMode(true, 200000000000);
      console.log("🔧 测试模式已启用，使用模拟价格");
      console.log("🏗️  创建的拍卖实例地址:", instanceAddress);
      
      // 启用测试模式，避免调用真实预言机
      await auctionInstance.connect(seller).setTestMode(true, 200000000000);
      console.log("🔧 测试模式已启用，使用模拟价格");
      
      // 授权NFT给拍卖合约
      await myNFTContract.connect(seller).approve(instanceAddress, nftId);
      console.log("✅ NFT授权给拍卖合约成功");
    });
    
    it("应该成功创建NFT拍卖", async function () {
      // 设置拍卖参数
      const startingPrice = ethers.parseEther("0.1");
      const duration = 86400; // 24小时
      
      // 创建拍卖
      console.log("🏷️  开始创建NFT拍卖...");
      const tx = await auctionInstance.connect(seller).createAuction(
        await myNFTContract.getAddress(),
        nftId,
        startingPrice,
        duration
      );
      await tx.wait();
      
      console.log("✅ NFT拍卖创建成功");
      
      // 验证NFT所有权已转移给拍卖合约
      const owner = await myNFTContract.ownerOf(nftId);
      expect(owner).to.equal(await auctionInstance.getAddress());
      console.log("✅ NFT所有权已转移到拍卖合约");
      
      // 验证拍卖数据
      const auction = await auctionInstance.getAuction(nftId);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.nftContract).to.equal(await myNFTContract.getAddress());
      expect(auction.startingPrice).to.equal(startingPrice);
      console.log("✅ 拍卖数据验证通过");
    });
  });

  // 测试3: 拍卖出价功能
  describe("拍卖出价功能", function () {
    const startingPrice = ethers.parseEther("0.1");
    const duration = 86400;
    
    beforeEach(async function () {
      // 创建拍卖实例
      const createAuctionTx = await auctionFactoryProxy.connect(seller).createAuction(mockPriceFeedAddress);
      await createAuctionTx.wait();
      const instanceAddress = await auctionFactoryProxy.auctionInstances(0);
      auctionInstance = await ethers.getContractAt("MyAuction", instanceAddress);
      
      // 授权并创建拍卖
      await myNFTContract.connect(seller).approve(instanceAddress, nftId);
      await auctionInstance.connect(seller).createAuction(
        await myNFTContract.getAddress(),
        nftId,
        startingPrice,
        duration
      );
    });

    it("应该成功出价并更新最高出价", async function () {
      // 第一个出价者出价
      const bidAmount1 = ethers.parseEther("0.15");
      console.log(`💰 出价者1出价: ${ethers.formatEther(bidAmount1)} ETH`);
      
      const tx1 = await auctionInstance.connect(bidder1).placeBid(nftId, { value: bidAmount1 });
      await tx1.wait();
      
      // 验证第一个出价
      const auctionAfterFirstBid = await auctionInstance.getAuction(nftId);
      expect(auctionAfterFirstBid.highestBidder).to.equal(bidder1.address);
      expect(auctionAfterFirstBid.highestBid).to.equal(bidAmount1);
      
      // 第二个出价者出更高的价格
      const bidAmount2 = ethers.parseEther("0.2");
      console.log(`💰 出价者2出价: ${ethers.formatEther(bidAmount2)} ETH`);
      
      const tx2 = await auctionInstance.connect(bidder2).placeBid(nftId, { value: bidAmount2 });
      await tx2.wait();
      
      // 验证第二个出价
      const auctionAfterSecondBid = await auctionInstance.getAuction(nftId);
      expect(auctionAfterSecondBid.highestBidder).to.equal(bidder2.address);
      expect(auctionAfterSecondBid.highestBid).to.equal(bidAmount2);
      
      console.log("✅ 出价功能测试通过");
    });

    it("应该拒绝低于起始价格的出价", async function () {
      const lowBid = ethers.parseEther("0.05");
      console.log(`❌ 尝试低于起始价格的出价: ${ethers.formatEther(lowBid)} ETH`);
      
      await expect(auctionInstance.connect(bidder1).placeBid(nftId, { value: lowBid }))
        .to.be.reverted;
      
      console.log("✅ 成功拒绝低于起始价格的出价");
    });
  });

  // 测试4: 结束拍卖功能
  describe("结束拍卖功能", function () {
    const startingPrice = ethers.parseEther("0.1");
    const duration = 60; // 60秒，便于测试
    
    beforeEach(async function () {
      // 创建拍卖实例
      const createAuctionTx = await auctionFactoryProxy.connect(seller).createAuction(mockPriceFeedAddress);
      await createAuctionTx.wait();
      const instanceAddress = await auctionFactoryProxy.auctionInstances(0);
      auctionInstance = await ethers.getContractAt("MyAuction", instanceAddress);
      
      // 授权并创建拍卖
      await myNFTContract.connect(seller).approve(instanceAddress, nftId);
      await auctionInstance.connect(seller).createAuction(
        await myNFTContract.getAddress(),
        nftId,
        startingPrice,
        duration
      );
      
      // 出价
      const bidAmount = ethers.parseEther("0.15");
      await auctionInstance.connect(bidder1).placeBid(nftId, { value: bidAmount });
    });

    it("应该成功结束拍卖并转移NFT和资金", async function () {
      // 增加时间以便拍卖结束
      console.log("⏰ 增加时间使拍卖结束...");
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");
      
      // 结束拍卖
      console.log("🏁 结束拍卖...");
      const tx = await auctionInstance.endAuction(nftId);
      await tx.wait();
      
      // 验证NFT所有权已转移给出价者
      const owner = await myNFTContract.ownerOf(nftId);
      expect(owner).to.equal(bidder1.address);
      console.log("✅ NFT已转移给中标者");
      
      // 验证卖家有待提现金额
      const pendingWithdrawal = await auctionInstance.getPendingWithdrawal(seller.address);
      expect(pendingWithdrawal).to.equal(ethers.parseEther("0.15"));
      console.log("✅ 卖家有待提现金额");
    });
  });

  // 测试5: 提现功能
  describe("提现功能", function () {
    const startingPrice = ethers.parseEther("0.1");
    const duration = 60;
    
    beforeEach(async function () {
      // 创建拍卖实例
      const createAuctionTx = await auctionFactoryProxy.connect(seller).createAuction(mockPriceFeedAddress);
      await createAuctionTx.wait();
      const instanceAddress = await auctionFactoryProxy.auctionInstances(0);
      auctionInstance = await ethers.getContractAt("MyAuction", instanceAddress);
      
      // 授权并创建拍卖
      await myNFTContract.connect(seller).approve(instanceAddress, nftId);
      await auctionInstance.connect(seller).createAuction(
        await myNFTContract.getAddress(),
        nftId,
        startingPrice,
        duration
      );
      
      // 出价
      await auctionInstance.connect(bidder1).placeBid(nftId, { value: ethers.parseEther("0.15") });
      
      // 结束拍卖
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");
      await auctionInstance.endAuction(nftId);
    });

    it("应该成功提现资金", async function () {
      // 记录提现前的余额
      const balanceBefore = await ethers.provider.getBalance(seller.address);
      
      // 执行提现
      console.log("💸 执行提现...");
      const withdrawTx = await auctionInstance.connect(seller).withdraw();
      const receipt = await withdrawTx.wait();
      
      // 计算gas费用
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.effectiveGasPrice;
      const gasCost = gasUsed * gasPrice;
      
      // 验证余额增加
      const balanceAfter = await ethers.provider.getBalance(seller.address);
      const expectedIncrease = ethers.parseEther("0.15");
      
      console.log(`💰 提现前余额: ${ethers.formatEther(balanceBefore)} ETH`);
      console.log(`💰 提现后余额: ${ethers.formatEther(balanceAfter)} ETH`);
      console.log(`💰 Gas费用: ${ethers.formatEther(gasCost)} ETH`);
      
      // 考虑gas费用的情况下验证余额变化
      expect(balanceAfter).to.be.at.least(balanceBefore.add(expectedIncrease).sub(gasCost));
      
      // 验证待提现金额已清零
      const pendingWithdrawal = await auctionInstance.getPendingWithdrawal(seller.address);
      expect(pendingWithdrawal).to.equal(0);
      
      console.log("✅ 提现功能测试通过");
    });
  });

  // 测试6: 取消拍卖功能
  describe("取消拍卖功能", function () {
    const startingPrice = ethers.parseEther("0.1");
    const duration = 86400;
    
    beforeEach(async function () {
      // 创建拍卖实例
      const createAuctionTx = await auctionFactoryProxy.connect(seller).createAuction(ethers.ZeroAddress);
      await createAuctionTx.wait();
      const instanceAddress = await auctionFactoryProxy.auctionInstances(0);
      auctionInstance = await ethers.getContractAt("MyAuction", instanceAddress);
      
      // 启用测试模式，避免调用真实预言机
      await auctionInstance.connect(seller).setTestMode(true, 200000000000);
      console.log("🔧 测试模式已启用，使用模拟价格");
      
      // 授权并创建拍卖
      await myNFTContract.connect(seller).approve(instanceAddress, nftId);
      await auctionInstance.connect(seller).createAuction(
        await myNFTContract.getAddress(),
        nftId,
        startingPrice,
        duration
      );
    });

    it("应该成功取消没有出价的拍卖", async function () {
      console.log("❌ 取消拍卖...");
      const tx = await auctionInstance.connect(seller).cancelAuction(nftId);
      await tx.wait();
      
      // 验证NFT已返还给卖家
      const owner = await myNFTContract.ownerOf(nftId);
      expect(owner).to.equal(seller.address);
      console.log("✅ NFT已返还给卖家");
      
      // 验证拍卖不再活跃
      const isActive = await auctionInstance.isAuctionActive(nftId);
      expect(isActive).to.be.false;
      console.log("✅ 拍卖状态已更新为非活跃");
    });

    it("应该拒绝取消已有出价的拍卖", async function () {
      // 先出价
      await auctionInstance.connect(bidder1).placeBid(nftId, { value: ethers.parseEther("0.15") });
      
      // 尝试取消拍卖
      console.log("❌ 尝试取消已有出价的拍卖...");
      await expect(auctionInstance.connect(seller).cancelAuction(nftId))
        .to.be.reverted;
      console.log("✅ 成功拒绝取消已有出价的拍卖");
    });

    it("应该拒绝非卖家取消拍卖", async function () {
      console.log("❌ 尝试非卖家取消拍卖...");
      await expect(auctionInstance.connect(bidder1).cancelAuction(nftId))
        .to.be.reverted;
      console.log("✅ 成功拒绝非卖家取消拍卖");
    });
  });
});