const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 部署逻辑合约
    const MyAuction = await ethers.getContractFactory("MyAuction");
    const MyAuctionDeploy = await MyAuction.deploy();
    // 在ethers v6中不需要调用deployed()
    const myAuctionAddress = await MyAuctionDeploy.getAddress();
    console.log("MyAuction implementation deployed to:", myAuctionAddress);

    // 直接使用OpenZeppelin的UpgradeableBeacon合约
    const UpgradeableBeacon = await ethers.getContractFactory("@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol:UpgradeableBeacon");
    const beaconDeploy = await UpgradeableBeacon.connect(deployer).deploy(myAuctionAddress, deployer.address);
    const beaconAddress = await beaconDeploy.getAddress();
    console.log("UpgradeableBeacon deployed to:", beaconAddress);

    // 部署工厂合约
    const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
    const auctionFactoryProxy = await upgrades.deployProxy(AuctionFactory, [beaconAddress], {
        initializer: 'initialize',
        kind: 'uups'
    });
    
    // 获取部署的地址
    const factoryAddress = await auctionFactoryProxy.getAddress();
    console.log("AuctionFactory proxy deployed to:", factoryAddress);

    // 保存合约地址到文件，供测试脚本使用
    const addresses = {
        MyAuctionImpl: myAuctionAddress,
        UpgradeableBeacon: beaconAddress,
        AuctionFactoryProxy: factoryAddress,
        network: hre.network.name
    };
    
    // 确保deployments目录存在
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }
    
    // 保存到文件
    const addressesPath = path.join(deploymentsDir, `${hre.network.name}.json`);
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log("合约地址已保存到:", addressesPath);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });