/**
 * polkadot-connector.js
 * 
 * Core connection functionality for Polkadot blockchain integration.
 * This module provides methods to connect to Polkadot networks,
 * manage accounts, and handle transactions.
 * 
 * Part of the Polkadot Educational Web Platform
 */

class PolkadotConnector {
  /**
   * Initialize the Polkadot connector
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.api = null;
    this.connected = false;
    this.networkEndpoint = config.networkEndpoint || 'wss://rpc.polkadot.io';
    this.connectionListeners = [];
    this.accounts = [];
  }

  /**
   * Connect to the Polkadot network
   * @returns {Promise} - Resolves when connected
   */
  async connect() {
    try {
      // Dynamic import to ensure compatibility with browser environments
      const { ApiPromise, WsProvider } = await import('https://cdn.jsdelivr.net/npm/@polkadot/api@16/+esm');
      
      console.log(`Connecting to Polkadot network at ${this.networkEndpoint}...`);
      
      // Create a WebSocket provider with the endpoint
      const wsProvider = new WsProvider(this.networkEndpoint);
      
      // Create the API instance
      this.api = await ApiPromise.create({ provider: wsProvider });
      
      // Wait for the API to be ready
      await this.api.isReady;
      
      // Get chain information
      const [chain, nodeName, nodeVersion] = await Promise.all([
        this.api.rpc.system.chain(),
        this.api.rpc.system.name(),
        this.api.rpc.system.version()
      ]);
      
      console.log(`Connected to ${chain} using ${nodeName} v${nodeVersion}`);
      
      this.connected = true;
      this._notifyConnectionListeners(true);
      
      // Set up connection monitoring
      this._monitorConnection(wsProvider);
      
      return {
        chain: chain.toString(),
        nodeName: nodeName.toString(),
        nodeVersion: nodeVersion.toString(),
        api: this.api
      };
    } catch (error) {
      console.error('Failed to connect to Polkadot network:', error);
      this._notifyConnectionListeners(false, error);
      throw error;
    }
  }

  /**
   * Disconnect from the Polkadot network
   */
  async disconnect() {
    if (this.api && this.connected) {
      try {
        await this.api.disconnect();
        console.log('Disconnected from Polkadot network');
        this.connected = false;
        this._notifyConnectionListeners(false);
      } catch (error) {
        console.error('Error disconnecting from Polkadot network:', error);
        throw error;
      }
    }
  }

  /**
   * Monitor the connection status
   * @param {WsProvider} provider - The WebSocket provider
   * @private
   */
  _monitorConnection(provider) {
    provider.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.connected = false;
      this._notifyConnectionListeners(false, error);
    });

    provider.on('disconnected', () => {
      console.log('Disconnected from Polkadot network');
      this.connected = false;
      this._notifyConnectionListeners(false);
    });

    provider.on('connected', () => {
      console.log('Connected to Polkadot network');
      this.connected = true;
      this._notifyConnectionListeners(true);
    });
  }

  /**
   * Add a connection status listener
   * @param {Function} listener - Callback function for connection status changes
   */
  addConnectionListener(listener) {
    if (typeof listener === 'function') {
      this.connectionListeners.push(listener);
    }
  }

  /**
   * Remove a connection status listener
   * @param {Function} listener - The listener to remove
   */
  removeConnectionListener(listener) {
    const index = this.connectionListeners.indexOf(listener);
    if (index !== -1) {
      this.connectionListeners.splice(index, 1);
    }
  }

  /**
   * Notify all connection listeners of status changes
   * @param {boolean} connected - Connection status
   * @param {Error} error - Error object if applicable
   * @private
   */
  _notifyConnectionListeners(connected, error = null) {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected, error);
      } catch (err) {
        console.error('Error in connection listener:', err);
      }
    });
  }

  /**
   * Check if connected to the network
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.connected && this.api !== null;
  }

  /**
   * Connect to the browser wallet via Polkadot.js extension
   * @returns {Promise<Object>} Selected account information
   */
  async connectWallet() {
    if (!window.injectedWeb3 || Object.keys(window.injectedWeb3).length === 0) {
      throw new Error('Polkadot.js extension not found');
    }

    const { web3Enable, web3Accounts } = await import('https://cdn.jsdelivr.net/npm/@polkadot/extension-dapp@16/+esm');
    await web3Enable('Astranet Education Demo');
    const accounts = await web3Accounts();

    if (!accounts.length) {
      throw new Error('No accounts available in the extension');
    }

    this.accounts = accounts;
    const account = accounts[0];
    return { address: account.address, name: account.meta.name };
  }

  /**
   * Get the current network information
   * @returns {Promise<Object>} - Network information
   */
  async getNetworkInfo() {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const [chain, nodeName, nodeVersion, properties] = await Promise.all([
        this.api.rpc.system.chain(),
        this.api.rpc.system.name(),
        this.api.rpc.system.version(),
        this.api.rpc.system.properties()
      ]);

      return {
        chain: chain.toString(),
        nodeName: nodeName.toString(),
        nodeVersion: nodeVersion.toString(),
        tokenSymbol: properties.tokenSymbol.toString(),
        tokenDecimals: properties.tokenDecimals.toNumber(),
        ss58Format: properties.ss58Format.toNumber()
      };
    } catch (error) {
      console.error('Error getting network information:', error);
      throw error;
    }
  }

  /**
   * Create a new account
   * @param {string} mnemonic - Optional mnemonic phrase
   * @returns {Promise<Object>} - The created account
   */
  async createAccount(mnemonic = null) {
    try {
      // Dynamic import to ensure compatibility with browser environments
      const { Keyring } = await import('https://cdn.jsdelivr.net/npm/@polkadot/keyring@16/+esm');
      const { mnemonicGenerate } = await import('https://cdn.jsdelivr.net/npm/@polkadot/util-crypto@16/+esm');
      
      // Generate a mnemonic if not provided
      const seedPhrase = mnemonic || mnemonicGenerate();
      
      // Create a keyring instance
      const keyring = new Keyring({ type: 'sr25519' });
      
      // Add an account using the mnemonic
      const account = keyring.addFromMnemonic(seedPhrase);
      
      const newAccount = {
        address: account.address,
        publicKey: account.publicKey,
        mnemonic: seedPhrase,
        type: 'sr25519'
      };
      
      this.accounts.push(newAccount);
      
      return newAccount;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  /**
   * Import an account using a mnemonic phrase
   * @param {string} mnemonic - The mnemonic phrase
   * @returns {Promise<Object>} - The imported account
   */
  async importAccount(mnemonic) {
    try {
      return await this.createAccount(mnemonic);
    } catch (error) {
      console.error('Error importing account:', error);
      throw error;
    }
  }

  /**
   * Export an account
   * @param {string} address - The account address
   * @returns {Object} - The exported account data
   */
  exportAccount(address) {
    const account = this.accounts.find(acc => acc.address === address);
    
    if (!account) {
      throw new Error(`Account with address ${address} not found`);
    }
    
    return {
      address: account.address,
      mnemonic: account.mnemonic,
      type: account.type
    };
  }

  /**
   * Get account balance
   * @param {string} address - The account address
   * @returns {Promise<Object>} - Account balance information
   */
  async getBalance(address) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const { data: balance } = await this.api.query.system.account(address);
      
      return {
        free: balance.free.toString(),
        reserved: balance.reserved.toString(),
        miscFrozen: balance.miscFrozen.toString(),
        feeFrozen: balance.feeFrozen.toString()
      };
    } catch (error) {
      console.error('Error getting account balance:', error);
      throw error;
    }
  }

  /**
   * Sign and send a transaction
   * @param {Object} transaction - The transaction to send
   * @param {string} senderAddress - The sender's address
   * @param {string} senderMnemonic - The sender's mnemonic for signing
   * @returns {Promise<Object>} - Transaction result
   */
  async signAndSendTransaction(transaction, senderAddress, senderMnemonic) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      // Dynamic import to ensure compatibility with browser environments
      const { Keyring } = await import('https://cdn.jsdelivr.net/npm/@polkadot/keyring@16/+esm');
      
      // Create a keyring instance
      const keyring = new Keyring({ type: 'sr25519' });
      
      // Get the account from the mnemonic
      const account = keyring.addFromMnemonic(senderMnemonic);
      
      // Verify the address matches
      if (account.address !== senderAddress) {
        throw new Error('Mnemonic does not match the provided address');
      }
      
      // Create the transaction
      const tx = this.api.tx[transaction.module][transaction.method](...transaction.params);
      
      // Sign and send the transaction
      return new Promise((resolve, reject) => {
        tx.signAndSend(account, ({ status, events, dispatchError }) => {
          if (status.isInBlock || status.isFinalized) {
            // Check if there was an error
            if (dispatchError) {
              if (dispatchError.isModule) {
                // For module errors, we have the section and method
                const decoded = this.api.registry.findMetaError(dispatchError.asModule);
                const { docs, name, section } = decoded;
                
                reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
              } else {
                // Other, CannotLookup, BadOrigin, no extra info
                reject(new Error(dispatchError.toString()));
              }
            } else {
              // Success, resolve with the block hash and events
              resolve({
                status: status.type,
                blockHash: status.isFinalized ? status.asFinalized.toHex() : status.asInBlock.toHex(),
                events: events.map(({ event }) => ({
                  section: event.section,
                  method: event.method,
                  data: event.data.toString()
                }))
              });
            }
          }
        }).catch(error => {
          reject(error);
        });
      });
    } catch (error) {
      console.error('Error signing and sending transaction:', error);
      throw error;
    }
  }

  /**
   * Estimate transaction fees
   * @param {Object} transaction - The transaction
   * @param {string} senderAddress - The sender's address
   * @returns {Promise<Object>} - Fee estimation
   */
  async estimateTransactionFees(transaction, senderAddress) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      // Create the transaction
      const tx = this.api.tx[transaction.module][transaction.method](...transaction.params);
      
      // Get the payment info
      const paymentInfo = await tx.paymentInfo(senderAddress);
      
      return {
        partialFee: paymentInfo.partialFee.toString(),
        weight: paymentInfo.weight.toString()
      };
    } catch (error) {
      console.error('Error estimating transaction fees:', error);
      throw error;
    }
  }

  /**
   * Fetch the most recent blocks
   * @param {number} count - Number of blocks to retrieve
   * @returns {Promise<Array>} - Parsed block data
   */
  async getRecentBlocks(count) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const latestHeader = await this.api.rpc.chain.getHeader();
      const latestNumber = latestHeader.number.toNumber();
      const blocks = [];

      for (let i = 0; i < count && latestNumber - i >= 0; i++) {
        const blockNumber = latestNumber - i;
        blocks.push(await this.getBlock(blockNumber));
      }

      return blocks;
    } catch (error) {
      console.error('Error getting recent blocks:', error);
      throw error;
    }
  }

  /**
   * Fetch a specific block by number
   * @param {number} blockNumber - Block number to fetch
   * @returns {Promise<Object>} - Parsed block data
   */
  async getBlock(blockNumber) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
      const signedBlock = await this.api.rpc.chain.getBlock(blockHash);
      const header = signedBlock.block.header;

      return {
        number: header.number.toNumber(),
        hash: blockHash.toHex(),
        parentHash: header.parentHash.toHex(),
        stateRoot: header.stateRoot.toHex(),
        extrinsicsRoot: header.extrinsicsRoot.toHex(),
        extrinsics: signedBlock.block.extrinsics.map((ex) => ex.toHuman())
      };
    } catch (error) {
      console.error(`Error getting block ${blockNumber}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve a transaction by hash
   * Searches recent blocks when direct RPC is unavailable
   * @param {string} hash - Transaction hash
   * @returns {Promise<Object|null>} - Transaction data or null if not found
   */
  async getTransaction(hash) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      if (this.api.rpc.eth && this.api.rpc.eth.getTransactionByHash) {
        const tx = await this.api.rpc.eth.getTransactionByHash(hash);
        return tx ? tx.toHuman() : null;
      }

      if (this.api.rpc.chain.getTransaction) {
        const tx = await this.api.rpc.chain.getTransaction(hash);
        return tx.isSome ? tx.unwrap().toHuman() : null;
      }

      // Fallback: scan last 100 blocks for the transaction
      const latestHeader = await this.api.rpc.chain.getHeader();
      let latestNumber = latestHeader.number.toNumber();

      for (let i = 0; i < 100 && latestNumber - i >= 0; i++) {
        const blockNumber = latestNumber - i;
        const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
        const signedBlock = await this.api.rpc.chain.getBlock(blockHash);
        for (const extrinsic of signedBlock.block.extrinsics) {
          if (extrinsic.hash.toHex() === hash) {
            return {
              hash,
              blockNumber,
              blockHash: blockHash.toHex(),
              method: extrinsic.method.toHuman(),
              signer: extrinsic.signer?.toString() || null,
              args: extrinsic.args.map((arg) => arg.toHuman())
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting transaction:', error);
      throw error;
    }
  }

  /**
   * Fetch recent transfer transactions by scanning latest blocks.
   * This focuses on balance transfers for demo purposes.
   * @param {number} limit - Number of transactions to return
   * @returns {Promise<Array>} Parsed transaction data
   */
  async getRecentTransactions(limit) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const latestHeader = await this.api.rpc.chain.getHeader();
      const latestNumber = latestHeader.number.toNumber();
      const transactions = [];

      for (let i = 0; i < 100 && transactions.length < limit && latestNumber - i >= 0; i++) {
        const blockNumber = latestNumber - i;
        const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
        const signedBlock = await this.api.rpc.chain.getBlock(blockHash);

        for (const extrinsic of signedBlock.block.extrinsics) {
          const { method, signer } = extrinsic;
          if (method.section === 'balances' && (method.method === 'transfer' || method.method === 'transferKeepAlive')) {
            transactions.push({
              hash: extrinsic.hash.toHex(),
              blockNumber,
              from: signer ? signer.toString() : '',
              to: method.args[0].toString(),
              value: method.args[1].toString()
            });

            if (transactions.length >= limit) {
              break;
            }
          }
        }
      }

      return transactions;
    } catch (error) {
      console.error('Error getting recent transactions:', error);
      throw error;
    }
  }

  /**
   * Get accounts with the highest balances
   * @param {number} limit - Number of accounts to return
   * @returns {Promise<Array>} - Sorted account data
   */
  async getTopAccounts(limit) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const entries = await this.api.query.system.account.entries();

      const accounts = entries
        .map(([key, { data }]) => ({
          address: key.args[0].toString(),
          balance: data.free.toString(),
          transactions: data.nonce.toNumber()
        }))
        .sort((a, b) => BigInt(b.balance) - BigInt(a.balance))
        .slice(0, limit);

      return accounts;
    } catch (error) {
      console.error('Error getting top accounts:', error);
      throw error;
    }
  }

  /**
   * Retrieve active validators for the current era
   * @param {number} limit - Number of validators to return
   * @returns {Promise<Array>} - Validator information
   */
  async getActiveValidators(limit) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const validatorIds = await this.api.query.session.validators();
      const activeEraInfo = await this.api.query.staking.activeEra();
      const activeEra = activeEraInfo.isSome ? activeEraInfo.unwrap().index : 0;

      const validatorData = [];

      for (const id of validatorIds.slice(0, limit)) {
        const [exposure, prefs, blocks] = await Promise.all([
          this.api.query.staking.erasStakers(activeEra, id),
          this.api.query.staking.erasValidatorPrefs(activeEra, id),
          this.api.query.imOnline?.authoredBlocks(activeEra, id) || 0
        ]);

        validatorData.push({
          address: id.toString(),
          stakedAmount: exposure.total.toString(),
          commission: prefs.commission?.toNumber() / 1e7 || 0,
          blocksProduced: blocks?.toNumber ? blocks.toNumber() : 0
        });
      }

      return validatorData;
    } catch (error) {
      console.error('Error getting active validators:', error);
      throw error;
    }
  }
}

// Export the PolkadotConnector class
export default PolkadotConnector;
