# Redact Automation Bot

A simple and clean automation bot for performing Encrypt, Decrypt, and Claim tasks on the Redact protocol (Sepolia Testnet). This project is designed to be lightweight, easy to configure, and run from the command line.

## Features

-   **Automated Cycles**: Automatically performs Encrypt -> Decrypt -> Claim sequences.
-   **Multi-Account Support**: Loads all private keys from `pk.txt` and processes them sequentially.
-   **Proxy Support**: Uses proxies from `proxy.txt` to rotate IP addresses for each account.
-   **Customizable Configuration**: Easily change cycle count, value ranges, and wait times in `config.json`.
-   **Clean Logging**: Provides clear, color-coded status updates for each action.
-   **Safe Shutdown**: Can be stopped gracefully by pressing `Ctrl+C`.

# How to Use

## 🛠️ Requirements

* **Node.js**: Version 18 or newer is recommended.
* **npm**: Comes installed automatically with Node.js.

---

## 🚀 Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/erectus7/Fhenix
    cd Fhenix
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

---

## 📄 Configuration

The bot's configuration is divided into two parts: file setup and in-script setup.

### 1. File Setup

Create the following two files in the main project folder:

* **`pk.txt`**
    Fill it with all your wallet private keys, with each key on a new line.
    ```
    0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    ```

* **`proxies.txt`** (Optional)
    If you want to use proxies, fill it with your HTTP proxies. The order of proxies must correspond to the order of private keys.
    ```
    http://user:pass@host:port
    http://user2:pass2@host2:port2
    ```
* **`config.json`**
  ```bash
  {
  "cycleCount": 1,
  "encryptRange": {
    "min": 0.0005,
    "max": 0.001
  },
  "decryptRange": {
    "min": 0.0004,
    "max": 0.0008
  },
  "waitHours": 24
  }

