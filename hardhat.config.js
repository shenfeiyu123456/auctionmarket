// 导入Hardhat核心插件
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
require("@openzeppelin/hardhat-upgrades");
// 导入自定义任务
require("./tasks/test_sepolia_contracts");

// 导入核心模块
const fs = require("fs");
const path = require("path");

// 加载自定义任务
const tasksDir = path.join(__dirname, "tasks");
if (fs.existsSync(tasksDir)) {
  fs.readdirSync(tasksDir).forEach(file => {
    require(path.join(tasksDir, file));
  });
}

/**
 * 环境变量加载函数 - 使用标准.env文件
 */
function loadEnvironmentVariables() {
  console.log("==========================================");
  console.log("开始加载环境变量...");
  
  const envFilePath = path.join(process.cwd(), ".env");
  
  if (fs.existsSync(envFilePath)) {
    console.log(`  ✓ 找到.env文件: ${envFilePath}`);
    try {
      // 使用dotenv加载.env文件
      const dotenv = require("dotenv");
      const result = dotenv.config();
      
      if (result.error) {
        console.log(`  ❌ .env文件加载出错: ${result.error.message}`);
      } else {
        console.log("  ✅ 成功从.env文件加载环境变量");
      }
    } catch (err) {
      console.log(`  ❌ 加载.env文件时出错: ${err.message}`);
    }
  } else {
    console.log("  ❌ 未找到.env文件");
  }
  
  // ========== 环境变量状态显示 ==========
  console.log("\n环境变量状态:");
  console.log(`  SEPOLIA_RPC_URL: ${process.env.SEPOLIA_RPC_URL || 'undefined'}`);
  console.log(`  PRIVATE_KEY: ${process.env.PRIVATE_KEY ? '已设置(已隐藏)' : 'undefined'}`);
  console.log(`  ETHERSCAN_API_KEY: ${process.env.ETHERSCAN_API_KEY ? '已设置' : 'undefined'}`);
  
  // ========== 最终检查 ==========
  const hasEnvVars = process.env.SEPOLIA_RPC_URL || process.env.PRIVATE_KEY;
  if (!hasEnvVars) {
    console.log("\n⚠️  警告: 未找到有效的环境变量");
    console.log("  - 本地开发可以继续，但部署到测试网/主网将需要配置环境变量");
    console.log("  - 设置步骤: 创建.env文件并配置所需变量");
  }
  console.log("==========================================");
}

/**
 * 确保dotenv依赖可用并加载环境变量
 */
try {
  // 尝试加载dotenv模块
  require("dotenv");
  loadEnvironmentVariables();
} catch (e) {
  // 如果dotenv未安装，尝试自动安装
  console.log("dotenv依赖未安装，正在尝试安装...");
  const { execSync } = require("child_process");
  try {
    execSync("npm install dotenv --save-dev");
    console.log("✅ dotenv安装成功");
    // 清除缓存并重新加载
    delete require.cache[require.resolve("dotenv")];
    loadEnvironmentVariables();
  } catch (err) {
    console.log(`❌ dotenv安装失败: ${err.message}`);
    console.log("尝试不使用dotenv直接加载环境变量...");
    loadEnvironmentVariables();
  }
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_PROJECT_ID",
      // 使用环境变量中的私钥，而不是硬编码
      // 注意：确保.env文件已添加到.gitignore中
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      // 本地网络可以使用默认账户，不需要私钥
    }
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
    deployments: "./deployments",
  },
  // Hardhat Deploy 插件配置 - 控制特殊部署文件生成
  external: {
    contracts: [],
    deployments: {
      hardhat: ["./deployments/hardhat"],
    },
  },
  // 配置部署输出
  deploy: {
    // 主部署文件将输出到deployments目录
    path: "./deploy",
    // 网络特定的部署信息输出目录
    deploymentsDir: "./deployments",
    // 排除README.md文件
    exclude: [
      "README.md",
      "**/*.md",
      "utils"
    ],
  },
};
