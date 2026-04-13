require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);
const HASHKEY_TESTNET_RPC = process.env.HASHKEY_TESTNET_RPC || "https://testnet.hsk.xyz";
const HASHKEY_MAINNET_RPC = process.env.HASHKEY_MAINNET_RPC || "https://mainnet.hsk.xyz";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    hardhat: {
      chainId: 31337,
    },
    hashkeyTestnet: {
      url: HASHKEY_TESTNET_RPC,
      chainId: 133,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
    hashkeyMainnet: {
      url: HASHKEY_MAINNET_RPC,
      chainId: 177,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      hashkeyTestnet: "no-api-key-needed",
      hashkeyMainnet: process.env.HASHKEY_EXPLORER_API_KEY || "no-api-key-needed",
    },
    customChains: [
      {
        network: "hashkeyTestnet",
        chainId: 133,
        urls: {
          apiURL: "https://testnet-explorer.hsk.xyz/api",
          browserURL: "https://testnet-explorer.hsk.xyz",
        },
      },
      {
        network: "hashkeyMainnet",
        chainId: 177,
        urls: {
          apiURL: "https://explorer.hsk.xyz/api",
          browserURL: "https://explorer.hsk.xyz",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};
