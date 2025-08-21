import chalk from "chalk";
import figlet from "figlet";
import { ethers } from "ethers";
import fs from "fs";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import axios from "axios";

const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com/";
const SEPOLIA_CHAIN_ID = 11155111;
const EETH_ADDRESS = "0x87A3effB84CBE1E4caB6Ab430139eC41d156D55A";
const CONFIG_FILE = "config.json";
const isDebug = false;

let accounts = [];
let proxies = [];
let isRunning = false;
let shouldStop = false;
let nonceTracker = {};
let configuration = {
  cycleCount: 1,
  encryptRange: { min: 0.0005, max: 0.001 },
  decryptRange: { min: 0.0004, max: 0.0008 },
  waitHours: 24,
};

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
];

const Headers = {
  'accept': 'application/json, text/plain, */*',
  'content-type': 'application/json',
  'origin': 'https://test.redact.money',
  'referer': 'https://test.redact.money/',
};

function displayHeader() {
  console.clear();
  const headerText = figlet.textSync("Redact Bot", { font: "Standard" });
  console.log(chalk.cyan(headerText));
  console.log(chalk.yellow("====================================================="));
  console.log(chalk.white("      Encrypt/Decrypt Automation Bot for Redact"));
  console.log(chalk.white(`            Professional Edition - Clean & Simple`));
  console.log(chalk.yellow("=====================================================\n"));
}

function printLog(message, type = "info") {
  if (type === "debug" && !isDebug) return;
  const timestamp = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta" });
  let icon, color;

  switch (type) {
    case "error":
      icon = "❌";
      color = chalk.redBright;
      break;
    case "success":
      icon = "✅";
      color = chalk.greenBright;
      break;
    case "warning":
      icon = "⚠️";
      color = chalk.yellowBright;
      break;
    case "wait":
      icon = "⏳";
      color = chalk.blueBright;
      break;
    case "info":
      icon = "ℹ️";
      color = chalk.whiteBright;
      break;
    case "debug":
      icon = "🐞";
      color = chalk.gray;
      break;
    default:
      icon = "➡️";
      color = chalk.white;
  }

  console.log(color(`${icon} [${timestamp}] ${message}`));
}

const getShortAddress = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "N/A";
const getShortHash = (hash) => `${hash.slice(0, 6)}...${hash.slice(-4)}`;

async function delay(ms) {
    if (shouldStop) return;

    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds <= 0) {
        await new Promise(resolve => setTimeout(resolve, ms));
        return;
    }
    
    const progressBarLength = 30;
    let lastMessageLength = 0;

    for (let second = 0; second < totalSeconds; second++) {
        if (shouldStop) {
            process.stdout.write("\r" + " ".repeat(lastMessageLength) + "\r");
            break;
        }

        const progress = Math.floor(((second + 1) / totalSeconds) * progressBarLength);
        const progressBar = "=".repeat(progress) + " ".repeat(progressBarLength - progress);
        
        const remainingTime = totalSeconds - second;
        const hours = Math.floor(remainingTime / 3600);
        const minutes = Math.floor((remainingTime % 3600) / 60);
        const seconds = remainingTime % 60;
        
        let timeString = "";
        if (hours > 0) timeString += `${hours}h `;
        if (minutes > 0) timeString += `${minutes}m `;
        timeString += `${seconds}s`;

        const message = chalk.blueBright(`⏳ Waiting for ${timeString}... [${progressBar}]`);
        process.stdout.write("\r" + message);
        lastMessageLength = message.length;

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    process.stdout.write("\n");
}

function loadConfiguration() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf8");
      const configFromFile = JSON.parse(data);
      configuration.cycleCount = Number(configFromFile.cycleCount) || 1;
      configuration.encryptRange.min = Number(configFromFile.encryptRange?.min) || 0.0005;
      configuration.encryptRange.max = Number(configFromFile.encryptRange?.max) || 0.001;
      configuration.decryptRange.min = Number(configFromFile.decryptRange?.min) || 0.0004;
      configuration.decryptRange.max = Number(configFromFile.decryptRange?.max) || 0.0008;
      configuration.waitHours = Number(configFromFile.waitHours) || 24;
      printLog("Configuration loaded successfully from config.json.", "success");
    } else {
      printLog("config.json not found, using default settings.", "warning");
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(configuration, null, 2));
      printLog("A new config.json file has been created with default settings.", "info");
    }
  } catch (error) {
    printLog(`Failed to load configuration: ${error.message}`, "error");
  }
}

function loadAccounts() {
  try {
    const data = fs.readFileSync("pk.txt", "utf8");
    accounts = data.split("\n").map(line => line.trim()).filter(line => line).map(privateKey => ({ privateKey }));
    if (accounts.length === 0) throw new Error("No private keys found in pk.txt");
    printLog(`Successfully loaded ${accounts.length} accounts from pk.txt.`, "success");
  } catch (error) {
    printLog(`Failed to load accounts: ${error.message}`, "error");
    process.exit(1);
  }
}

function loadProxies() {
  try {
    if (fs.existsSync("proxy.txt")) {
      const data = fs.readFileSync("proxy.txt", "utf8");
      proxies = data.split("\n").map(p => p.trim()).filter(p => p);
      if (proxies.length > 0) printLog(`Successfully loaded ${proxies.length} proxies from proxy.txt.`, "success");
      else printLog("proxy.txt is empty. Running without proxies.", "info");
    } else {
      printLog("proxy.txt not found. Running without proxies.", "info");
    }
  } catch (error) {
    printLog(`Failed to load proxies: ${error.message}`, "error");
  }
}

function createAgent(proxyUrl) {
    if (!proxyUrl) return null;
    return proxyUrl.startsWith("socks") ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl);
}

function getProvider(proxyUrl) {
    const agent = createAgent(proxyUrl);
    const fetchOptions = agent ? { agent } : {};
    return new ethers.JsonRpcProvider(SEPOLIA_RPC_URL, {
        chainId: SEPOLIA_CHAIN_ID,
        name: "Sepolia"
    }, { fetchOptions });
}

async function getNextNonce(provider, walletAddress) {
    if (shouldStop) throw new Error("Process stopped.");
    const nonceKey = `${SEPOLIA_CHAIN_ID}_${walletAddress}`;
    try {
        const pendingNonce = BigInt(await provider.getTransactionCount(walletAddress, "pending"));
        const lastUsedNonce = nonceTracker[nonceKey] || (pendingNonce - 1n);
        const nextNonce = pendingNonce > lastUsedNonce + 1n ? pendingNonce : lastUsedNonce + 1n;
        nonceTracker[nonceKey] = nextNonce;
        printLog(`Nonce for ${getShortAddress(walletAddress)} is ${nextNonce}.`, "debug");
        return nextNonce;
    } catch (error) {
        printLog(`Failed to get nonce for ${getShortAddress(walletAddress)}: ${error.message}`, "error");
        throw error;
    }
}

async function getGasParameters(provider) {
    try {
        const feeData = await provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            return {
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                type: 2
            };
        }
        return { gasPrice: feeData.gasPrice || ethers.parseUnits("1", "gwei"), type: 0 };
    } catch (error) {
        printLog(`Failed to get fee data, using default.`, "debug");
        return { gasPrice: ethers.parseUnits("1", "gwei"), type: 0 };
    }
}

async function awaitConfirmation(tx, actionName) {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Transaction confirmation timed out.")), 120000)
    );
    const receipt = await Promise.race([tx.wait(), timeoutPromise]);

    if (receipt.status === 0) {
        throw new Error("Transaction reverted.");
    }
    printLog(`${actionName} confirmed successfully! Hash: ${chalk.cyan(getShortHash(tx.hash))}`, "success");
}

async function sendTransaction(wallet, txParams, actionName, proxyUrl) {
    const provider = getProvider(proxyUrl);
    wallet = wallet.connect(provider);
    
    let tx;
    try {
        const nonce = await getNextNonce(provider, wallet.address);
        tx = await wallet.sendTransaction({ ...txParams, nonce });
        printLog(`${actionName} sent. Awaiting confirmation... Hash: ${chalk.cyan(getShortHash(tx.hash))}`, "wait");
        await awaitConfirmation(tx, actionName);
    } catch (error) {
        printLog(`Failed to send ${actionName} transaction: ${error.message}`, "error");
        if (error.message.includes("nonce")) {
            printLog("Nonce error detected, resetting nonce for the next attempt.", "warning");
            delete nonceTracker[`${SEPOLIA_CHAIN_ID}_${wallet.address}`];
        }
        throw error;
    }
}

async function performEncrypt(wallet, amount, proxyUrl) {
    const amountWei = ethers.parseEther(amount.toString());
    const iface = new ethers.Interface(['function encryptETH(address to) payable']);
    const txData = iface.encodeFunctionData('encryptETH', [wallet.address]);
    
    const gasParameters = await getGasParameters(getProvider(proxyUrl));
    const txParams = {
        to: EETH_ADDRESS,
        data: txData,
        value: amountWei,
        gasLimit: 750000n,
        ...gasParameters
    };
    
    await sendTransaction(wallet, txParams, `Encrypt ${amount} ETH`, proxyUrl);
}

async function performDecrypt(wallet, amount, proxyUrl) {
    const amountWei = ethers.parseUnits(amount.toString(), 18);
    const iface = new ethers.Interface(['function decrypt(address to, uint128 value)']);
    const txData = iface.encodeFunctionData('decrypt', [wallet.address, amountWei]);
    
    const gasParameters = await getGasParameters(getProvider(proxyUrl));
    const txParams = {
        to: EETH_ADDRESS,
        data: txData,
        value: 0n,
        gasLimit: 750000n,
        ...gasParameters
    };
    
    await sendTransaction(wallet, txParams, `Decrypt ${amount} eETH`, proxyUrl);
}

async function performClaim(wallet, proxyUrl) {
    const iface = new ethers.Interface(['function claimAllDecrypted()']);
    const txData = iface.encodeFunctionData('claimAllDecrypted');
    
    const gasParameters = await getGasParameters(getProvider(proxyUrl));
    const txParams = {
        to: EETH_ADDRESS,
        data: txData,
        value: 0n,
        gasLimit: 750000n,
        ...gasParameters
    };
    
    await sendTransaction(wallet, txParams, "Claim all", proxyUrl);
}

async function processSingleAccount(accountIndex) {
    const { privateKey } = accounts[accountIndex];
    const proxyUrl = proxies.length > 0 ? proxies[accountIndex % proxies.length] : null;
    const wallet = new ethers.Wallet(privateKey);
    const provider = getProvider(proxyUrl);
    
    console.log(chalk.yellow("\n-----------------------------------------------------"));
    printLog(`Processing Account #${accountIndex + 1} | Address: ${chalk.magentaBright(getShortAddress(wallet.address))}`);
    if(proxyUrl) printLog(`Using proxy: ${proxyUrl}`, "info");

    try {
        const balanceETH = await provider.getBalance(wallet.address);
        printLog(`Initial Balance: ${chalk.cyan(Number(ethers.formatEther(balanceETH)).toFixed(6))} ETH`);
    } catch (e) {
        printLog(`Failed to check balance: ${e.message}`, "error");
        return;
    }

    for (let i = 0; i < configuration.cycleCount && !shouldStop; i++) {
        printLog(`Starting Cycle ${i + 1} of ${configuration.cycleCount}...`, "info");
        try {
            const encryptAmount = (Math.random() * (configuration.encryptRange.max - configuration.encryptRange.min) + configuration.encryptRange.min);
            printLog(`Attempting to encrypt ${encryptAmount.toFixed(6)} ETH`, "wait");
            await performEncrypt(wallet, encryptAmount.toFixed(6), proxyUrl);
            await delay(30 * 1000);
            
            if(shouldStop) break;

            const decryptAmount = (Math.random() * (configuration.decryptRange.max - configuration.decryptRange.min) + configuration.decryptRange.min);
            printLog(`Attempting to decrypt ${decryptAmount.toFixed(6)} eETH`, "wait");
            await performDecrypt(wallet, decryptAmount.toFixed(6), proxyUrl);
            await delay(15 * 1000);

            if(shouldStop) break;

            printLog(`Attempting to claim decrypted ETH`, "wait");
            await performClaim(wallet, proxyUrl);
            
            printLog(`Cycle ${i + 1} for Account #${accountIndex + 1} completed.`, "success");
            if (i < configuration.cycleCount - 1) {
                await delay(60 * 1000);
            }

        } catch (error) {
            printLog(`An error occurred during cycle ${i + 1}: ${error.message}`, "error");
            printLog(`Continuing to the next cycle/account after a short delay...`, "warning");
            await delay(10 * 1000);
        }
    }
    printLog(`All cycles for Account #${accountIndex + 1} have been completed.`, "success");
    console.log(chalk.yellow("-----------------------------------------------------"));
}

async function runBot() {
    isRunning = true;
    shouldStop = false;

    displayHeader();
    loadConfiguration();
    loadAccounts();
    loadProxies();

    printLog(`🚀 Bot started! Cycles per account: ${configuration.cycleCount}.`, "info");

    while (!shouldStop) {
        printLog("Starting a new round for all accounts...", "info");
        for (let i = 0; i < accounts.length && !shouldStop; i++) {
            await processSingleAccount(i);
            if (i < accounts.length - 1 && !shouldStop) {
                const delayBetweenAccounts = (Math.floor(Math.random() * (180 - 60 + 1)) + 60) * 1000;
                await delay(delayBetweenAccounts);
            }
        }

        if (shouldStop) break;

        const waitTimeMs = configuration.waitHours * 60 * 60 * 1000;
        printLog(`All accounts processed. Next round will begin in ${configuration.waitHours} hours.`, "success");
        await delay(waitTimeMs);
    }
    
    isRunning = false;
    printLog("🛑 Bot has been stopped by the user.", "info");
}

let isShutdownInitiated = false;
process.on('SIGINT', () => {
    if (isShutdownInitiated) {
        printLog("\n🚨 Forcing exit!", "error");
        process.exit(1);
    }

    if (!isRunning) {
        process.exit(0);
    }

    printLog("\n🔌 Stop request received. Finishing current task before exiting...", "warning");
    shouldStop = true;
    isShutdownInitiated = true;
});

runBot().catch(error => {
    printLog(`A fatal error occurred: ${error.message}`, "error");
});
