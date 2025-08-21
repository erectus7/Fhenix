# Redact Automation Bot

A simple and clean automation bot for performing Encrypt, Decrypt, and Claim tasks on the Redact protocol (Sepolia Testnet). This project is designed to be lightweight, easy to configure, and run from the command line.

## Features

-   **Automated Cycles**: Automatically performs Encrypt -> Decrypt -> Claim sequences.
-   **Multi-Account Support**: Loads all private keys from `pk.txt` and processes them sequentially.
-   **Proxy Support**: Uses proxies from `proxy.txt` to rotate IP addresses for each account.
-   **Customizable Configuration**: Easily change cycle count, value ranges, and wait times in `config.json`.
-   **Clean Logging**: Provides clear, color-coded status updates for each action.
-   **Safe Shutdown**: Can be stopped gracefully by pressing `Ctrl+C`.

## How to Use

### 1. Installation

Clone this repository and install the required dependencies.

```bash
git clone https://github.com/erectus7/Fhenix
cd Fhenix
npm install


