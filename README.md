# NFT 拍卖市场智能合约

这是一个基于以太坊的NFT拍卖市场智能合约系统，支持创建拍卖、竞价（包含基于预言机喂价的价格机制）、结束拍卖和资金管理等功能。

## 项目结构

```
auctionmarket/
├── contracts/             # Solidity 智能合约
│   ├── MyNFT.sol          # NFT 合约，用于创建可拍卖的 NFT
│   ├── AuctionStore.sol   # 拍卖数据存储合约
│   ├── MyAuction.sol      # 核心拍卖合约，包含竞价逻辑和喂价功能
│   └── AuctionFactory.sol # 拍卖实例工厂合约
├── deploy/                # 部署脚本
│   ├── 01_deploy_mynft.js
│   ├── 02_deploy_auctionstore.js
│   ├── 03_deploy_myauction.js
│   └── 04_deploy_auctionfactory.js
├── test/                  # 测试脚本
│   ├── testHelpers.js
│   ├── MyNFT.test.js
│   ├── AuctionStore.test.js
│   ├── MyAuction.test.js
│   └── AuctionFactory.test.js
├── hardhat.config.js      # Hardhat 配置文件
└── README.md              # 项目说明文档
```

## 合约功能说明

### 1. MyNFT.sol
- 基于 ERC721 的 NFT 合约
- 支持铸造新的 NFT
- 包含基本的所有权管理

### 2. AuctionStore.sol
- 管理拍卖数据存储
- 提供拍卖创建、更新和结束功能
- 处理用户提款管理

### 3. MyAuction.sol
- 核心拍卖逻辑实现
- 支持创建拍卖、出价、结束拍卖
- **集成预言机喂价功能**，基于 ETH/USD 价格进行出价验证
- 实现基于 USD 价值的最低出价增量机制（默认 5%）
- 支持提款和收益领取功能

### 4. AuctionFactory.sol
- 创建 MyAuction 合约实例的工厂
- 管理所有创建的拍卖实例
- 支持更新拍卖模板

## 部署说明

### 前置条件

- Node.js v14 或更高版本
- npm 或 yarn
- Hardhat 开发环境

### 安装依赖

```bash
npm install
# 或
yarn install
```

### 编译合约

```bash
npx hardhat compile
```

### 运行测试

```bash
npx hardhat test
```

### 部署合约

```bash
# 部署到本地网络
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# 部署到其他网络（需要配置 hardhat.config.js）
npx hardhat run scripts/deploy.js --network <network-name>
```

## 使用方法

### 1. 铸造 NFT

```javascript
// 通过 MyNFT 合约铸造
await myNFT.mintNFT(userAddress, tokenURI);
```

### 2. 创建拍卖

```javascript
// 使用 MyAuction 合约创建拍卖
await myAuction.createAuction(tokenId, startingPrice, duration);
```

### 3. 出价

```javascript
// 出价（系统会自动检查基于 USD 价值的最低增量）
await myAuction.placeBid(auctionId, { value: bidAmount });
```

### 4. 结束拍卖

```javascript
// 结束拍卖
await myAuction.endAuction(auctionId);
```

### 5. 领取收益

```javascript
// 卖家领取收益
await myAuction.claimProceeds(auctionId);

// 未中标者取回资金
await myAuction.withdrawFunds();
```

### 6. 创建拍卖实例（通过工厂）

```javascript
// 创建新的拍卖合约实例
await auctionFactory.createMyAuctionInstance();
```

## 预言机喂价机制

MyAuction 合约集成了预言机喂价功能，使用 ETH/USD 价格来确定有效的出价增量。主要特性：

- 通过 `getEthPrice()` 函数获取当前 ETH 价格
- 基于 USD 价值计算最低出价增量（而非简单的 ETH 数量）
- 默认最低出价增量为 5%（可通过 `setMinBidIncrementPercentage()` 调整）
- 管理员可以设置 0.01% 到 50% 之间的最低增量百分比

## 安全注意事项

- 确保预言机数据来源可靠
- 在生产环境中部署前进行全面的安全审计
- 考虑添加紧急暂停功能以应对潜在漏洞
- 注意处理重入攻击风险

## 许可证

MIT