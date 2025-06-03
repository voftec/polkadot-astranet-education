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
    this.accounts = []; // Stores accounts from createAccount, importAccount, and connectWallet
  }

  /**
   * Connect to the Polkadot network
   * @returns {Promise} - Resolves when connected
   */
  async connect() {
    try {
      // Dynamic import using stable versions for Polkadot libraries
      const { ApiPromise, WsProvider } = await import('https://cdn.jsdelivr.net/npm/@polkadot/api@13/+esm');
      
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
      this.api = null; // Ensure API is null on connection failure
      this.connected = false;
      this._notifyConnectionListeners(false, error);
      throw error;
    }
  }

  /**
   * Disconnect from the Polkadot network
   */
  async disconnect() {
    if (this.api && this.api.isConnected) { // Check api.isConnected as well
      try {
        await this.api.disconnect();
        console.log('Disconnected from Polkadot network');
      } catch (error) {
        console.error('Error disconnecting from Polkadot network:', error);
        // Even if disconnect() throws, we consider it disconnected from our perspective
      }
    }
    this.connected = false;
    this.api = null;
    this._notifyConnectionListeners(false);
  }

  /**
   * Monitor the connection status
   * @param {WsProvider} provider - The WebSocket provider
   * @private
   */
  _monitorConnection(provider) {
    provider.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (this.connected) { // Only notify if status changed
        this.connected = false;
        this._notifyConnectionListeners(false, error);
      }
    });

    provider.on('disconnected', () => {
      console.log('WebSocket disconnected');
      if (this.connected) { // Only notify if status changed
        this.connected = false;
        this._notifyConnectionListeners(false);
      }
    });

    // Note: The 'connected' event from WsProvider indicates WebSocket layer connection.
    // ApiPromise.isReady is the true signal for application-level readiness.
    // This listener primarily handles re-connections.
    provider.on('connected', async () => {
      console.log('WebSocket (re)connected. Ensuring API is ready...');
      if (!this.api || !this.api.isConnected) {
         // If API is not there or not connected, it might be a fresh connection or recovery
         // Re-check API readiness (or re-initialize if needed, though ApiPromise handles some of this)
         if (this.api) {
            await this.api.isReady; // Ensure API is ready again
         } else {
            // This case should ideally not happen if connect() succeeded initially
            // and provider is still being monitored.
            console.warn('WebSocket connected, but API instance is missing.');
            return;
         }
      }
      if (!this.connected) { // Only notify if status changed from disconnected to connected
        this.connected = true;
        this._notifyConnectionListeners(true);
      }
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
    this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
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
    return this.connected && this.api !== null && this.api.isConnected;
  }

  /**
   * Connect to the browser wallet via Polkadot.js extension
   * @returns {Promise<Object>} Selected account information
   */
  async connectWallet() {
    if (typeof window === 'undefined' || !window.injectedWeb3 || Object.keys(window.injectedWeb3).length === 0) {
      throw new Error('Polkadot.js extension not found. Please install it.');
    }

    // Using stable version for extension-dapp
    const { web3Enable, web3Accounts } = await import('https://cdn.jsdelivr.net/npm/@polkadot/extension-dapp@0.47/+esm');
    
    const extensions = await web3Enable('Astranet Education Demo');
    if (extensions.length === 0) {
        throw new Error('Polkadot.js extension access was not granted or no extension is present.');
    }
    
    const accounts = await web3Accounts();

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available in the extension. Please create or import an account in your Polkadot.js extension.');
    }

    // Store extension accounts. Be mindful of mixing with locally generated accounts if needed.
    // For this example, we'll add them to the general `this.accounts` list.
    // You might want to differentiate them if `exportAccount` or signing logic depends on account type.
    this.accounts = accounts.map(acc => ({
        address: acc.address,
        name: acc.meta.name,
        source: acc.meta.source, // Keep track of where the account came from
        type: acc.type // e.g. 'sr25519', 'ed25519'
    }));

    const selectedAccount = this.accounts[0]; // Typically, UI would allow user to select
    return { address: selectedAccount.address, name: selectedAccount.name };
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
        this.api.rpc.system.properties() // Fetches ChainProperties
      ]);

      // Safely extract chain properties
      // tokenSymbol and tokenDecimals are Option<Vec<Type>>
      const firstTokenSymbol = properties.tokenSymbol.isSome && !properties.tokenSymbol.unwrap().isEmpty 
        ? properties.tokenSymbol.unwrap()[0].toString() 
        : 'UNIT'; // Default if not specified or empty
      const firstTokenDecimals = properties.tokenDecimals.isSome && !properties.tokenDecimals.unwrap().isEmpty
        ? properties.tokenDecimals.unwrap()[0].toNumber()
        : 12; // Default if not specified or empty
      const ss58 = properties.ss58Format.isSome 
        ? properties.ss58Format.unwrap().toNumber() 
        : (this.api.registry.chainSS58 !== undefined ? this.api.registry.chainSS58 : 42); // Use registry default or Polkadot default

      return {
        chain: chain.toString(),
        nodeName: nodeName.toString(),
        nodeVersion: nodeVersion.toString(),
        tokenSymbol: firstTokenSymbol,
        tokenDecimals: firstTokenDecimals,
        ss58Format: ss58
      };
    } catch (error) {
      console.error('Error getting network information:', error);
      throw error;
    }
  }

  /**
   * Create a new account (generates a mnemonic)
   * @param {string} mnemonic - Optional mnemonic phrase. If not provided, one will be generated.
   * @returns {Promise<Object>} - The created account { address, publicKey, mnemonic, type }
   */
  async createAccount(mnemonic = null) {
    try {
      // Dynamic import using stable versions
      const { Keyring } = await import('https://cdn.jsdelivr.net/npm/@polkadot/keyring@13/+esm');
      const { mnemonicGenerate, mnemonicValidate } = await import('https://cdn.jsdelivr.net/npm/@polkadot/util-crypto@13/+esm');
      
      const seedPhrase = mnemonic || mnemonicGenerate();
      if (!mnemonicValidate(seedPhrase)) {
        throw new Error('Invalid mnemonic phrase provided.');
      }
      
      const keyring = new Keyring({ type: 'sr25519', ss58Format: this.api?.registry.chainSS58 });
      const account = keyring.addFromMnemonic(seedPhrase);
      
      const newAccount = {
        address: account.address,
        publicKey: Buffer.from(account.publicKey).toString('hex'), // More standard representation
        mnemonic: seedPhrase,
        type: 'sr25519', // Keyring type
        source: 'local' // Indicate it's a locally generated account
      };
      
      // Add to internal list, avoiding duplicates by address
      if (!this.accounts.find(acc => acc.address === newAccount.address)) {
        this.accounts.push(newAccount);
      }
      
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
    if (!mnemonic || typeof mnemonic !== 'string') {
        throw new Error('Mnemonic phrase must be a non-empty string.');
    }
    // `createAccount` handles mnemonic validation and creation
    return this.createAccount(mnemonic);
  }

  /**
   * Export an account's sensitive data (mnemonic).
   * Only works for accounts generated locally or imported via mnemonic.
   * @param {string} address - The account address
   * @returns {Object} - The exported account data { address, mnemonic, type }
   */
  exportAccount(address) {
    const account = this.accounts.find(acc => acc.address === address);
    
    if (!account) {
      throw new Error(`Account with address ${address} not found.`);
    }
    
    if (!account.mnemonic) {
      throw new Error(`Account ${address} cannot be exported as it does not have an associated mnemonic (e.g., it might be from a browser extension or hardware wallet).`);
    }
    
    return {
      address: account.address,
      mnemonic: account.mnemonic,
      type: account.type // This would be the crypto type like 'sr25519'
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
      // api.query.system.account returns AccountInfo
      const { data: balance } = await this.api.query.system.account(address);
      
      return {
        free: balance.free.toString(),
        reserved: balance.reserved.toString(),
        miscFrozen: balance.frozen?.toString() || balance.miscFrozen?.toString() || '0', // Adapt to API version for frozen field
        feeFrozen: balance.feeFrozen?.toString() || '0' // Adapt to API version
      };
    } catch (error) {
      console.error(`Error getting account balance for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Sign and send a transaction using a mnemonic.
   * For extension-based accounts, signing should be handled via extension's signer.
   * @param {Object} transaction - The transaction to send { module, method, params }
   * @param {string} senderAddress - The sender's address
   * @param {string} senderMnemonic - The sender's mnemonic for signing
   * @returns {Promise<Object>} - Transaction result including status, blockHash, and events
   */
  async signAndSendTransaction(transaction, senderAddress, senderMnemonic) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }
    if (!senderMnemonic) {
        throw new Error('Sender mnemonic is required for signing this type of transaction.');
    }

    try {
      const { Keyring } = await import('https://cdn.jsdelivr.net/npm/@polkadot/keyring@13/+esm');
      
      const keyring = new Keyring({ type: 'sr25519', ss58Format: this.api.registry.chainSS58 });
      const account = keyring.addFromMnemonic(senderMnemonic);
      
      if (account.address !== senderAddress) {
        throw new Error('Mnemonic does not match the provided sender address. Ensure the correct SS58 format is used if comparing.');
      }
      
      const tx = this.api.tx[transaction.module][transaction.method](...transaction.params);
      
      return new Promise((resolve, reject) => {
        tx.signAndSend(account, ({ status, events = [], dispatchError }) => {
          console.log('Transaction status:', status.type);

          if (status.isInBlock || status.isFinalized) {
            events.forEach(({ event: { data, method, section } }) => {
              console.log(`\t${section}.${method}: ${data.toString()}`);
            });

            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = this.api.registry.findMetaError(dispatchError.asModule);
                const { docs, name, section } = decoded;
                const errorMsg = `${section}.${name}: ${docs.join(' ')}`;
                console.error('Transaction Error:', errorMsg);
                reject(new Error(errorMsg));
              } else {
                const errorMsg = dispatchError.toString();
                console.error('Transaction Error:', errorMsg);
                reject(new Error(errorMsg));
              }
            } else {
              resolve({
                status: status.type,
                blockHash: status.isFinalized ? status.asFinalized.toHex() : status.asInBlock.toHex(),
                events: events.map(({ event }) => ({
                  section: event.section,
                  method: event.method,
                  data: event.data.map(d => d.toHuman()) // Make data more readable
                }))
              });
            }
          } else if (status.isDropped || status.isInvalid || status.isUsurped) {
            console.error('Transaction failed with status:', status.type);
            reject(new Error(`Transaction ${status.type}`));
          }
        }).catch(error => {
          console.error('Error during signAndSend:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Error preparing or signing transaction:', error);
      throw error;
    }
  }

  /**
   * Estimate transaction fees
   * @param {Object} transaction - The transaction { module, method, params }
   * @param {string} senderAddress - The sender's address (can be any valid address for estimation)
   * @returns {Promise<Object>} - Fee estimation { partialFee, weight }
   */
  async estimateTransactionFees(transaction, senderAddress) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const tx = this.api.tx[transaction.module][transaction.method](...transaction.params);
      const paymentInfo = await tx.paymentInfo(senderAddress);
      
      return {
        partialFee: paymentInfo.partialFee.toString(),
        weight: paymentInfo.weight.toString() // For v2 Weight, it has refTime and proofSize. toString() might be complex.
                                            // Consider: paymentInfo.weight.refTime.toString() and paymentInfo.weight.proofSize.toString()
      };
    } catch (error) {
      console.error('Error estimating transaction fees:', error);
      throw error;
    }
  }

  /**
   * Fetch the most recent blocks
   * @param {number} count - Number of blocks to retrieve (e.g., 5)
   * @returns {Promise<Array<Object>>} - Parsed block data
   */
  async getRecentBlocks(count = 5) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }
    if (count <= 0) return [];

    try {
      const latestHeader = await this.api.rpc.chain.getHeader();
      const latestNumber = latestHeader.number.unwrap().toNumber(); // unwrap() for Compact<BlockNumber>
      const blocks = [];

      for (let i = 0; i < count && (latestNumber - i) >= 0; i++) {
        const blockNumber = latestNumber - i;
        // Fetching one by one can be slow; consider batching if API supports or for larger counts.
        const blockData = await this.getBlock(blockNumber);
        if (blockData) blocks.push(blockData);
      }
      return blocks;
    } catch (error) {
      console.error('Error getting recent blocks:', error);
      throw error;
    }
  }

  /**
   * Fetch a specific block by number
   * @param {number | BigInt} blockNumber - Block number to fetch
   * @returns {Promise<Object|null>} - Parsed block data or null if error
   */
  async getBlock(blockNumber) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
      if (!blockHash || blockHash.isEmpty) {
          console.warn(`No block hash found for block number ${blockNumber}`);
          return null;
      }

      // Using api.derive.chain.getBlock for a more comprehensive block details
      const signedBlock = await this.api.derive.chain.getBlock(blockHash);
      if (!signedBlock || !signedBlock.block) {
          console.warn(`Could not retrieve block data for hash ${blockHash.toHex()}`);
          return null;
      }

      const header = signedBlock.block.header;
      const validator = signedBlock.author ? signedBlock.author.toString() : ''; // author from derive
      const timestamp = signedBlock.block.extrinsics
        .find(ex => ex.method.section === 'timestamp' && ex.method.method === 'set')
        ?.method.args[0].toNumber() || 0;


      return {
        number: header.number.unwrap().toNumber(),
        hash: blockHash.toHex(),
        parentHash: header.parentHash.toHex(),
        stateRoot: header.stateRoot.toHex(),
        extrinsicsRoot: header.extrinsicsRoot.toHex(),
        timestamp: timestamp,
        transactions: signedBlock.block.extrinsics.length,
        validator,
        extrinsics: signedBlock.block.extrinsics.map((ex, index) => ({
            hash: ex.hash.toHex(),
            method: `${ex.method.section}.${ex.method.method}`,
            args: ex.method.args.map(a => a.toHuman()),
            signer: ex.signer?.toString() || null,
            isSigned: ex.isSigned,
            tip: ex.tip?.toString() || '0',
            nonce: ex.nonce?.toString() || '0',
            // Include success status if available (would require event processing for this extrinsic)
        }))
      };
    } catch (error) {
      console.error(`Error getting block ${blockNumber}:`, error);
      // Do not re-throw, allow getRecentBlocks to continue if one block fails
      return null; 
    }
  }

  /**
   * Retrieve a transaction by hash.
   * This is a simplified version; robust transaction fetching often requires an indexer.
   * Fallback scans recent blocks.
   * @param {string} hash - Transaction hash (extrinsic hash)
   * @returns {Promise<Object|null>} - Transaction data or null if not found
   */
  async getTransaction(hash) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      // Check for Ethereum compatibility layer (e.g., Moonbeam, Astar)
      if (this.api.rpc.eth && typeof this.api.rpc.eth.getTransactionByHash === 'function') {
        const tx = await this.api.rpc.eth.getTransactionByHash(hash);
        return tx ? tx.toHuman() : null; // .toHuman() might not exist on web3js-like result object.
                                        // This part needs testing on an actual Frontier node.
      }

      // Fallback: scan last N blocks (e.g., 100) for the transaction
      // This is resource-intensive and not guaranteed to find older transactions.
      console.log(`Falling back to scanning recent blocks for transaction hash ${hash}. This may take time.`);
      const latestHeader = await this.api.rpc.chain.getHeader();
      let latestNumber = latestHeader.number.unwrap().toNumber();
      const blocksToScan = 100; // Configurable: number of recent blocks to scan

      for (let i = 0; i < blocksToScan && latestNumber - i >= 0; i++) {
        const blockNumber = latestNumber - i;
        const blockData = await this.getBlock(blockNumber); // Use our existing getBlock
        
        if (blockData && blockData.extrinsics) {
          for (const extrinsic of blockData.extrinsics) {
            if (extrinsic.hash === hash) {
              return {
                hash: extrinsic.hash,
                blockNumber: blockData.number,
                blockHash: blockData.hash,
                method: extrinsic.method,
                signer: extrinsic.signer,
                args: extrinsic.args,
                isSigned: extrinsic.isSigned,
                tip: extrinsic.tip,
                nonce: extrinsic.nonce
              };
            }
          }
        }
        if (i > 0 && i % 10 === 0) { // Log progress
            console.log(`Scanned up to block ${blockNumber}...`);
        }
      }
      console.log(`Transaction ${hash} not found in the last ${blocksToScan} blocks.`);
      return null;
    } catch (error) {
      console.error(`Error getting transaction ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Fetch recent transfer transactions by scanning latest blocks.
   * This focuses on balances.transfer or balances.transferKeepAlive for demo.
   * @param {number} limit - Max number of transfer transactions to return
   * @param {number} blocksToScan - How many recent blocks to scan
   * @returns {Promise<Array<Object>>} Parsed transaction data
   */
  async getRecentTransactions(limit = 10, blocksToScan = 100) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const latestHeader = await this.api.rpc.chain.getHeader();
      const latestNumber = latestHeader.number.unwrap().toNumber();
      const transactions = [];

      for (let i = 0; i < blocksToScan && transactions.length < limit && (latestNumber - i) >= 0; i++) {
        const blockNumber = latestNumber - i;
        const blockData = await this.getBlock(blockNumber); // Use our getBlock

        if (blockData && blockData.extrinsics) {
            for (const extrinsic of blockData.extrinsics) {
                if (extrinsic.method.startsWith('balances.transfer') || // covers transfer, transferKeepAlive, transferAllowDeath etc.
                    extrinsic.method.startsWith('balances.forceTransfer')) {
                    
                    // Args structure for balances.transfer: [dest, value]
                    // Ensure args exist and have the expected structure
                    const toAddress = extrinsic.args && extrinsic.args[0] ? (extrinsic.args[0].Id || extrinsic.args[0]) : 'N/A';
                    const value = extrinsic.args && extrinsic.args[1] ? extrinsic.args[1] : 'N/A';
                    
                    transactions.push({
                        hash: extrinsic.hash,
                        blockNumber,
                        blockHash: blockData.hash,
                        from: extrinsic.signer,
                        to: toAddress.toString(), // .Id for AccountId32 in Human form, else direct
                        value: value.toString(),
                        method: extrinsic.method
                    });

                    if (transactions.length >= limit) break;
                }
            }
        }
        if (transactions.length >= limit) break;
      }
      return transactions;
    } catch (error) {
      console.error('Error getting recent transactions:', error);
      throw error;
    }
  }

  /**
   * Get accounts with the highest balances (top accounts by free balance).
   * Note: Querying all account entries can be very resource-intensive on large chains.
   * This might only be feasible on development/test networks or if the node supports it efficiently.
   * @param {number} limit - Number of accounts to return
   * @returns {Promise<Array<Object>>} - Sorted account data { address, balance, nonce }
   */
  async getTopAccounts(limit = 10) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    console.warn("Fetching top accounts by iterating all account entries. This can be slow and memory-intensive on large networks.");

    try {
      // api.query.system.account.entries() can be very large.
      // Use with caution on mainnets. Some nodes might restrict this query.
      const entries = await this.api.query.system.account.entries();

      const accounts = entries
        .map(([key, { data, nonce }]) => ({ // AccountInfo structure has data and nonce
          address: key.args[0].toString(), // The address part of the storage key
          balance: data.free.toString(),   // Free balance
          nonce: nonce.toNumber()          // Nonce (number of transactions)
        }))
        .sort((a, b) => BigInt(b.balance) - BigInt(a.balance)) // Sort by balance descending
        .slice(0, limit); // Take the top 'limit'

      return accounts;
    } catch (error)
    {
      console.error('Error getting top accounts:', error);
      if (error.message && error.message.includes("entry limit")) {
        console.warn("Node might have restricted query size for system.account.entries. Try reducing limit or use an indexer for this data.");
      }
      throw error;
    }
  }

  /**
   * Retrieve active validators for the current era.
   * @param {number} limit - Max number of validators to return (applied after fetching all)
   * @returns {Promise<Array<Object>>} - Validator information
   */
  async getActiveValidators(limit = 100) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Polkadot network');
    }

    try {
      const [validatorIds, activeEraOpt] = await Promise.all([
        this.api.query.session.validators(), // Returns Vec<ValidatorId>
        this.api.query.staking.activeEra()   // Returns Option<ActiveEraInfo>
      ]);

      if (!validatorIds.length || activeEraOpt.isNone) {
        console.warn('Could not retrieve validators or active era.');
        return [];
      }

      const activeEra = activeEraOpt.unwrap().index.toNumber(); // Get era index
      const validatorData = [];

      // Fetch details for each validator (up to the limit)
      // This involves multiple queries per validator, can be slow if limit is large.
      const limitedValidatorIds = validatorIds.slice(0, limit);

      for (const id of limitedValidatorIds) {
        try {
          const [exposureOpt, prefsOpt, authoredBlocksOpt] = await Promise.all([
            this.api.query.staking.erasStakers(activeEra, id),       // Exposure: total stake, nominators
            this.api.query.staking.erasValidatorPrefs(activeEra, id),// ValidatorPrefs: commission
            this.api.query.imOnline?.authoredBlocks(activeEra, id)   // Option<u32> if imOnline pallet exists
          ]);

          const exposure = exposureOpt.isSome ? exposureOpt.unwrap() : { total: BigInt(0), own: BigInt(0), others: [] };
          const prefs = prefsOpt.isSome ? prefsOpt.unwrap() : { commission: BigInt(0) }; // commission is Perbill
          
          let blocksProduced = 0;
          if (authoredBlocksOpt && authoredBlocksOpt.isSome) {
            blocksProduced = authoredBlocksOpt.unwrap().toNumber();
          }
          
          validatorData.push({
            address: id.toString(),
            stakedAmount: exposure.total.toString(),
            ownStake: exposure.own.toString(),
            nominatorCount: exposure.others.length,
            commission: (prefs.commission.toNumber() / 10_000_000).toFixed(2), // Perbill to percent (e.g., 50_000_000 is 5%)
            blocksProduced: blocksProduced
          });
        } catch (singleValidatorError) {
            console.warn(`Failed to fetch details for validator ${id.toString()}: ${singleValidatorError.message}`);
            // Optionally add a placeholder or skip this validator
        }
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
