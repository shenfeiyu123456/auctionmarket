const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("拍卖市场简单测试", function () {
  // 声明合约实例
  let myAuctionImplementation;
  let beacon;
  let factory;
  let myNFT;
  let mockPriceFeed;
  let accounts;

  beforeEach(async function () {
    // 获取账户
    const signers = await ethers.getSigners();
    accounts = {
      deployer: signers[0].address,
      seller: signers[1].address,
      bidder1: signers[2].address,
      bidder2: signers[3].address
    };
    console.log('测试账户:', accounts);

    try {
      // 部署模拟价格预言机
      const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
      console.log('📊 部署模拟价格预言机...');
      mockPriceFeed = await MockPriceFeed.deploy(8, 200000000000); // 8位小数，价格2000
      await mockPriceFeed.waitForDeployment();
      const priceFeedAddress = await mockPriceFeed.getAddress();
      console.log('📊 模拟价格预言机已部署，地址:', priceFeedAddress);

      // 部署MyAuction实现合约（可升级合约）
      const MyAuction = await ethers.getContractFactory("MyAuction");
      console.log('🔨 部署MyAuction实现合约...');
      myAuctionImplementation = await MyAuction.deploy();
      await myAuctionImplementation.waitForDeployment();
      const myAuctionImplAddress = await myAuctionImplementation.getAddress();
      console.log('🔨 MyAuction实现合约已部署，地址:', myAuctionImplAddress);

      // 部署UpgradeableBeacon（需要实现地址和管理员地址两个参数）
       const UpgradeableBeacon = await ethers.getContractFactory("UpgradeableBeacon");
       console.log('🗼 部署UpgradeableBeacon...');
       beacon = await UpgradeableBeacon.connect(signers[0]).deploy(myAuctionImplAddress, accounts.deployer);
       await beacon.waitForDeployment();
       const beaconAddress = await beacon.getAddress();
       console.log('🗼 UpgradeableBeacon已部署，地址:', beaconAddress);

      // 部署AuctionFactory合约
      const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
      console.log('🏭 部署AuctionFactory合约...');
      factory = await AuctionFactory.deploy();
      await factory.waitForDeployment();
      const factoryAddress = await factory.getAddress();
      console.log('🏭 AuctionFactory已部署，地址:', factoryAddress);

      // 初始化AuctionFactory
      await factory.initialize(beaconAddress);
      console.log('⚙️ AuctionFactory已初始化');

      // 部署MyNFT合约（无参数构造函数）
       const MyNFT = await ethers.getContractFactory("MyNFT");
       console.log('🎨 部署MyNFT合约...');
       myNFT = await MyNFT.deploy();
       await myNFT.waitForDeployment();
       const nftAddress = await myNFT.getAddress();
       console.log('🎨 MyNFT合约已部署，地址:', nftAddress);

      // 铸造一个NFT给卖家（必须使用合约所有者账户）
       await myNFT.connect(signers[0]).mint(accounts.seller);
       console.log('✅ NFT已铸造给卖家:', accounts.seller);

    } catch (error) {
      console.error('部署过程中发生错误:', error);
      throw error;
    }
  });

  describe("创建拍卖实例功能", function () {
    it("应该成功创建拍卖实例", async function () {
      try {
        const signers = await ethers.getSigners();
        const sellerSigner = signers[1];
        const nftAddress = await myNFT.getAddress();
        const priceFeedAddress = await mockPriceFeed.getAddress();
        
        // 卖家授权NFT给factory
        await myNFT.connect(sellerSigner).approve(factory.target, 1);
        console.log('🔑 卖家已授权NFT给工厂合约');
        
        // 设置拍卖参数
        const startingPrice = ethers.parseEther("0.1");
        const endTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后
        
        // 创建拍卖实例
        console.log('🚀 创建拍卖实例...');
        const tx = await factory.connect(sellerSigner).createAuction(
          priceFeedAddress  // 价格预言机地址
        );
        await tx.wait();
        console.log('✅ 拍卖实例创建成功');
        
        // 获取最新创建的拍卖实例地址
          const instanceCount = await factory.getInstanceCount();
          const lastAuctionAddress = await factory.auctionInstances(Number(instanceCount) - 1);
          console.log('🎯 最新拍卖实例地址:', lastAuctionAddress);
          
         // 验证实例数量
         expect(instanceCount).to.equal(1);
        
      } catch (error) {
        console.error('创建拍卖时发生错误:', error);
        throw error;
      }
    });
  });
});