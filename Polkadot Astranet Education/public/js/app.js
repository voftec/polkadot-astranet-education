/**
 * app.js
 * 
 * Main application logic for the Polkadot Educational Web Platform.
 * This file handles UI interactions, initializes components, and
 * integrates the Polkadot framework.
 * Firebase integration is NOT included in this version.
 */

import PolkadotConnector from './framework/polkadot-connector.js';
import BlockchainSelector from './framework/blockchain-selector.js';
import ContractDeployer from './framework/contract-deployer.js';

// Global references to Polkadot framework instances
let polkadotConnector;
let blockchainSelector;
let contractDeployer;
let connectedWallet = null; // Store connected wallet info { address, name, source }

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    initializePolkadotFramework();
    setupEventListeners();
});

/**
 * Initialize UI components and interactions
 */
function initializeUI() {
    console.log('Initializing UI components...');
    initializeTabs();
    initializeDarkMode();
    initializeMobileMenu();
    initializeModals();
    initializeProgressCircles(); // Will show static progress or 0 if no data
    updateDashboardWithStaticData(); // Dashboard will show static data
    console.log('UI components initialized');
}

/**
 * Initialize Polkadot framework components
 */
async function initializePolkadotFramework() {
    console.log('Initializing Polkadot framework...');
    try {
        polkadotConnector = new PolkadotConnector({
            networkEndpoint: 'wss://rpc.polkadot.io' // Default network
        });

        polkadotConnector.addConnectionListener(handleConnectionStatusChange);
        
        blockchainSelector = new BlockchainSelector(); // Will be configured after connector is ready
        
        await polkadotConnector.connect(); // Initial connection attempt
        // If connect() is successful, handleConnectionStatusChange will be called.
        // ContractDeployer and BlockchainSelector's connector are set in handleConnectionStatusChange.

    } catch (error) {
        console.error('Fatal error initializing Polkadot framework:', error);
        showErrorNotification('Failed to initialize Polkadot framework. Some features may not work.');
    }
}

/**
 * Handle Polkadot connection status changes
 * @param {boolean} connected - True if connected, false otherwise
 * @param {Error|null} error - Error object if connection failed
 */
function handleConnectionStatusChange(connected, error = null) {
    console.log(`Polkadot connection status: ${connected ? 'Connected' : 'Disconnected'}`);
    updateConnectionStatusDisplay(connected, error);

    if (connected && polkadotConnector && polkadotConnector.api) {
        // Configure selector and deployer now that we have a live API
        blockchainSelector.connector = polkadotConnector; // Pass the live connector
        contractDeployer = new ContractDeployer(polkadotConnector);
        
        // Populate network selector dropdown
        populateNetworkSelector();
        // Select current network in dropdown
        const currentNetworkInfo = blockchainSelector.networks.find(n => n.endpoint === polkadotConnector.networkEndpoint);
        if (currentNetworkInfo) {
            const networkSelect = document.getElementById('networkSelect');
            if (networkSelect) networkSelect.value = currentNetworkInfo.id;
        }


        loadBlockchainData(); // Load initial data for explorer
    } else {
        // If disconnected, perhaps clear blockchain data or show a message
        clearBlockchainDataDisplay();
    }
}


/**
 * Set up event listeners for UI interactions
 */
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Navigation links
    document.querySelectorAll('nav .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = e.target.getAttribute('href')?.substring(1);
            if (targetId) scrollToSection(targetId);
            
            document.querySelectorAll('nav .nav-link').forEach(navLink => navLink.classList.remove('active'));
            e.target.classList.add('active');
            
            const navList = document.getElementById('navList');
            if (navList) navList.classList.remove('active');
        });
    });
    
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            document.getElementById('navList')?.classList.toggle('active');
        });
    }
    
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', handleConnectWallet);
    }
    
    const deployContractBtn = document.getElementById('deployContractBtn');
    if (deployContractBtn) {
        deployContractBtn.addEventListener('click', handleDeployContract);
    }
    
    document.querySelectorAll('.contract-template-card button, [data-template]').forEach(button => {
        button.addEventListener('click', (e) => {
            const templateName = e.currentTarget.getAttribute('data-template');
            if(templateName) loadContractTemplate(templateName);
        });
    });
    
    document.querySelectorAll('[data-explorer-tab]').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.currentTarget.getAttribute('data-explorer-tab');
            if(tabName) switchExplorerTab(tabName);
        });
    });
    
    document.querySelectorAll('[data-dashboard-tab]').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.currentTarget.getAttribute('data-dashboard-tab');
            if(tabName) switchDashboardTab(tabName);
        });
    });
    
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const searchQuery = document.getElementById('explorerSearch')?.value;
            if (searchQuery) searchBlockchain(searchQuery);
        });
    }
        
    const startBasicsQuiz = document.getElementById('startBasicsQuiz');
    if (startBasicsQuiz) startBasicsQuiz.addEventListener('click', startBasicsQuizHandler);
    
    const loadArchitectureDiagram = document.getElementById('loadArchitectureDiagram');
    if (loadArchitectureDiagram) loadArchitectureDiagram.addEventListener('click', loadArchitectureDiagramHandler);
    
    const startCrossChainDemo = document.getElementById('startCrossChainDemo');
    if (startCrossChainDemo) startCrossChainDemo.addEventListener('click', startCrossChainDemoHandler);
    
    // Smart contract sandbox run button
    const runContractBtn = document.getElementById('runContract');
    if (runContractBtn) runContractBtn.addEventListener('click', runContractInSandbox);

    const networkSelectElement = document.getElementById('networkSelect');
    if (networkSelectElement) {
        networkSelectElement.addEventListener('change', handleNetworkChange);
    }

    console.log('Event listeners set up');
}

function initializeTabs() {
    // Learning section tabs
    document.querySelectorAll('.content-tabs .tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            if (!tabName) return;

            // Toggle visible content
            document.querySelectorAll('#learn .tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(`${tabName}-content`);
            if (content) content.classList.add('active');

            // Update button state
            document.querySelectorAll('.content-tabs .tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // Ensure default tabs are active on load
    const firstLearningTab = document.querySelector('.content-tabs .tab-button');
    if (firstLearningTab) firstLearningTab.click();

    switchExplorerTab('blocks');
    switchDashboardTab('overview');
}

function initializeDarkMode() {
    const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
    if (darkModeEnabled) {
        document.body.classList.add('dark-mode');
        updateDarkModeIcon(true);
    }
}

function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkModeIcon(isDarkMode);
}

function updateDarkModeIcon(isDarkMode) {
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.innerHTML = isDarkMode ? 
            '<i class="fas fa-sun"></i> Light Mode' : 
            '<i class="fas fa-moon"></i> Dark Mode';
    }
}

function initializeMobileMenu() {
    document.addEventListener('click', (e) => {
        const navList = document.getElementById('navList');
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        if (navList && mobileMenuToggle && navList.classList.contains('active')) {
            if (!navList.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                navList.classList.remove('active');
            }
        }
    });
}

function initializeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        const closeButton = modal.querySelector('.modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => modal.style.display = 'none');
        }
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

function initializeProgressCircles() {
    document.querySelectorAll('.progress-circle').forEach(circle => {
        const progress = parseInt(circle.getAttribute('data-progress'), 10) || 0;
        updateProgressCircle(circle, progress);
    });
}

function updateProgressCircle(circleElement, progress) {
    if (!circleElement) return;
    const radius = parseFloat(circleElement.getAttribute('r'));
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;
    circleElement.style.strokeDasharray = `${circumference} ${circumference}`;
    circleElement.style.strokeDashoffset = offset;
    
    const textElement = circleElement.closest('.progress-container')?.querySelector('.progress-text');
    if (textElement) textElement.textContent = `${progress}%`;
    
    circleElement.setAttribute('data-progress', progress.toString());
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

function updateConnectionStatusDisplay(connected, error = null) {
    const statusElement = document.getElementById('connectionStatus'); // Assuming an element to show status
    if (statusElement) {
        if (connected) {
            statusElement.textContent = `Connected to: ${polkadotConnector?.networkEndpoint}`;
            statusElement.className = 'status-connected';
        } else {
            statusElement.textContent = error ? `Connection failed: ${error.message}` : 'Disconnected';
            statusElement.className = 'status-disconnected';
        }
    }
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    if(connectWalletBtn) connectWalletBtn.disabled = !connected;
}

function updateDashboardWithStaticData() {
    // Since Firebase is disabled, we'll use static data or clear fields.
    const learningProgressCircleSvg = document.querySelector('#learningProgressCircle .progress-circle-bar'); // Assuming SVG structure
    if(learningProgressCircleSvg) updateProgressCircle(learningProgressCircleSvg, 0);

    const contractsCountEl = document.getElementById('contractsCount');
    if (contractsCountEl) contractsCountEl.textContent = '0';
    
    const transactionsCountEl = document.getElementById('transactionsCount');
    if (transactionsCountEl) transactionsCountEl.textContent = '0';

    const achievementsCountEl = document.getElementById('achievementsCount');
    if (achievementsCountEl) achievementsCountEl.textContent = '0';

    updateActivityList([]); // Empty list
    updateLearningModulesWithStaticData();
    updateContractsList([]);
    updateTransactionsList([]);
}

function updateActivityList(activities) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    activityList.innerHTML = activities.length > 0 ? 
        activities.map(act => `<li>${act.description} at ${new Date(act.timestamp).toLocaleString()}</li>`).join('') :
        '<li>No recent activity.</li>';
}

function updateLearningModulesWithStaticData() {
    const learningModulesContainer = document.getElementById('learningModules');
    if (!learningModulesContainer) return;
    const staticModules = [
        { id: 'basics', title: 'Introduction to Polkadot', description: 'Learn the fundamentals.', progress: 0, status: 'Not Started' },
        { id: 'architecture', title: 'Polkadot Architecture', description: 'Deep dive into the architecture.', progress: 0, status: 'Not Started' },
    ];
    learningModulesContainer.innerHTML = staticModules.map(module => `
        <div class="module-card">
            <h4>${module.title}</h4><p>${module.description}</p>
            <div class="progress-bar-container"><div class="progress-bar" style="width:${module.progress}%"></div></div>
            <button class="btn btn-primary" data-module-id="${module.id}">Start Module</button>
        </div>
    `).join('');
    // Add event listeners for these static module buttons if needed
    learningModulesContainer.querySelectorAll('[data-module-id]').forEach(button => {
        button.addEventListener('click', (e) => {
            const moduleId = e.currentTarget.getAttribute('data-module-id');
            startLearningModule(moduleId);
        });
    });
}

function updateContractsList(contracts) {
    const contractsList = document.getElementById('contractsList');
    if (!contractsList) return;
    contractsList.innerHTML = contracts.length > 0 ?
        contracts.map(c => `<li>${c.name || 'Unnamed Contract'} at ${c.address} on ${c.network}</li>`).join('') :
        '<p>No contracts deployed.</p>';
}

function updateTransactionsList(transactions) {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    transactionsList.innerHTML = transactions.length > 0 ?
        transactions.map(tx => `<li>Tx: ${tx.hash.substring(0,15)}... (${tx.status})</li>`).join('') :
        '<p>No transactions found.</p>';
}

async function loadBlockchainData() {
    if (!polkadotConnector || !polkadotConnector.isConnected()) {
        console.warn('Polkadot connector not ready for loading blockchain data.');
        return;
    }
    console.log('Loading blockchain data for explorer...');
    loadBlocks();
    loadTransactions();
    loadAccounts();
    loadValidators();
}

async function loadBlocks() {
    const blocksTableBody = document.querySelector('#blocksTable tbody');
    if (!blocksTableBody) return;
    blocksTableBody.innerHTML = `<tr><td colspan="5" class="text-center">Loading blocks...</td></tr>`;
    try {
        const blocks = await polkadotConnector.getRecentBlocks(5);
        updateBlocksTable(blocks);
    } catch (error) {
        console.error('Error loading blocks:', error);
        blocksTableBody.innerHTML = `<tr><td colspan="5" class="text-center">Error loading blocks.</td></tr>`;
    }
}

function updateBlocksTable(blocks) {
    const blocksTableBody = document.querySelector('#blocksTable tbody');
    if (!blocksTableBody) return;
    if (!blocks || blocks.length === 0) {
        blocksTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No blocks to display.</td></tr>`;
        return;
    }
    blocksTableBody.innerHTML = blocks.map(block => `
        <tr>
            <td>${block.number}</td>
            <td>${block.hash.substring(0,10)}...${block.hash.substring(block.hash.length-8)}</td>
            <td>${new Date(block.timestamp).toLocaleString()}</td>
            <td>${block.transactions}</td>
            <td>${block.validator ? block.validator.substring(0,10)+'...'+block.validator.substring(block.validator.length-8) : 'N/A'}</td>
        </tr>
    `).join('');
}

async function loadTransactions() {
    const txTableBody = document.querySelector('#transactionsTable tbody');
    if (!txTableBody) return;
    txTableBody.innerHTML = `<tr><td colspan="5" class="text-center">Loading transactions...</td></tr>`;
    try {
        const txs = await polkadotConnector.getRecentTransactions(5, 20); // Scan 20 blocks for 5 txs
        updateTransactionsTable(txs);
    } catch (error) {
        console.error('Error loading transactions:', error);
        txTableBody.innerHTML = `<tr><td colspan="5" class="text-center">Error loading transactions.</td></tr>`;
    }
}

function updateTransactionsTable(transactions) {
    const txTableBody = document.querySelector('#transactionsTable tbody');
    if (!txTableBody) return;
     if (!transactions || transactions.length === 0) {
        txTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No transactions to display.</td></tr>`;
        return;
    }
    txTableBody.innerHTML = transactions.map(tx => `
        <tr>
            <td>${tx.hash.substring(0,10)}...</td>
            <td>${tx.blockNumber}</td>
            <td>${tx.from.substring(0,10)}...</td>
            <td>${tx.to.substring(0,10)}...</td>
            <td>${(parseFloat(tx.value) / Math.pow(10, polkadotConnector?.api?.registry.chainDecimals[0] || 12)).toFixed(4)} ${polkadotConnector?.api?.registry.chainTokens[0] || 'UNIT'}</td>
        </tr>
    `).join('');
}

async function loadAccounts() {
    const accountsTableBody = document.querySelector('#accountsTable tbody');
    if (!accountsTableBody) return;
    accountsTableBody.innerHTML = `<tr><td colspan="3" class="text-center">Loading accounts...</td></tr>`;
    try {
        const accounts = await polkadotConnector.getTopAccounts(5);
        updateAccountsTable(accounts);
    } catch (error) {
        console.error('Error loading accounts:', error);
        accountsTableBody.innerHTML = `<tr><td colspan="4" class="text-center">Error loading accounts. ${error.message}</td></tr>`;
    }
}

function updateAccountsTable(accounts) {
    const accountsTableBody = document.querySelector('#accountsTable tbody');
    if (!accountsTableBody) return;
    if (!accounts || accounts.length === 0) {
        accountsTableBody.innerHTML = `<tr><td colspan="4" class="text-center">No accounts to display.</td></tr>`;
        return;
    }
    accountsTableBody.innerHTML = accounts.map((acc, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${acc.address.substring(0,15)}...${acc.address.substring(acc.address.length-10)}</td>
            <td>${(parseFloat(acc.balance) / Math.pow(10, polkadotConnector?.api?.registry.chainDecimals[0] || 12)).toFixed(4)} ${polkadotConnector?.api?.registry.chainTokens[0] || 'UNIT'}</td>
            <td>${acc.nonce}</td>
        </tr>
    `).join('');
}

async function loadValidators() {
    const validatorsTableBody = document.querySelector('#validatorsTable tbody');
    if (!validatorsTableBody) return;
    validatorsTableBody.innerHTML = `<tr><td colspan="4" class="text-center">Loading validators...</td></tr>`;
    try {
        const validators = await polkadotConnector.getActiveValidators(5);
        updateValidatorsTable(validators);
    } catch (error) {
        console.error('Error loading validators:', error);
        validatorsTableBody.innerHTML = `<tr><td colspan="4" class="text-center">Error loading validators.</td></tr>`;
    }
}

function updateValidatorsTable(validators) {
    const validatorsTableBody = document.querySelector('#validatorsTable tbody');
    if (!validatorsTableBody) return;
    if (!validators || validators.length === 0) {
        validatorsTableBody.innerHTML = `<tr><td colspan="4" class="text-center">No validators to display.</td></tr>`;
        return;
    }
    validatorsTableBody.innerHTML = validators.map((val, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${val.address.substring(0,15)}...</td>
            <td>${(parseFloat(val.stakedAmount) / Math.pow(10, polkadotConnector?.api?.registry.chainDecimals[0] || 12)).toFixed(2)} ${polkadotConnector?.api?.registry.chainTokens[0] || 'UNIT'}</td>
            <td>${val.commission}%</td>
        </tr>
    `).join('');
}

function switchExplorerTab(tabName) {
    document.querySelectorAll('.explorer-content').forEach(content => content.classList.remove('active'));
    const selectedContent = document.getElementById(`${tabName}-content`);
    if (selectedContent) selectedContent.classList.add('active');
    
    document.querySelectorAll('[data-explorer-tab]').forEach(btn => btn.classList.remove('active'));
    const selectedButton = document.querySelector(`[data-explorer-tab="${tabName}"]`);
    if (selectedButton) selectedButton.classList.add('active');
}

function switchDashboardTab(tabName) {
    document.querySelectorAll('.dashboard-content').forEach(content => content.classList.remove('active'));
    const selectedContent = document.getElementById(`${tabName}-content`);
    if (selectedContent) selectedContent.classList.add('active');

    document.querySelectorAll('[data-dashboard-tab]').forEach(btn => btn.classList.remove('active'));
    const selectedButton = document.querySelector(`[data-dashboard-tab="${tabName}"]`);
    if (selectedButton) selectedButton.classList.add('active');
}

async function searchBlockchain(query) {
    console.log('Searching blockchain for:', query);
    const searchResultsEl = document.getElementById('explorerSearchResults'); // Assuming an element for results
    if(searchResultsEl) searchResultsEl.innerHTML = `<p>Searching for "${query}"...</p>`;

    if (!polkadotConnector || !polkadotConnector.isConnected()) {
        showErrorNotification('Blockchain connector not initialized or not connected.');
        if(searchResultsEl) searchResultsEl.innerHTML = `<p class="error">Not connected to blockchain.</p>`;
        return;
    }
    
    try {
        if (/^\d+$/.test(query)) { // Block number
            const block = await polkadotConnector.getBlock(parseInt(query));
            showBlockDetails(block, searchResultsEl);
        } else if (query.startsWith('0x') && query.length === 66) { // Potential Hash (block or tx)
            // Try as block hash first
            let block = null;
            try {
                block = await polkadotConnector.getBlock(query);
            } catch(e) { /* ignore if not found as block hash */ }

            if (block) {
                showBlockDetails(block, searchResultsEl);
            } else { // Try as tx hash
                const tx = await polkadotConnector.getTransaction(query);
                showTransactionDetails(tx, searchResultsEl);
            }
        } else { // Account address (basic check, Polkadot addresses are more complex)
            const account = await polkadotConnector.getAccount(query); // Using the new getAccount method
            showAccountDetails(account, searchResultsEl);
        }
    } catch (error) {
        console.error('Search error:', error);
        if(searchResultsEl) searchResultsEl.innerHTML = `<p class="error">Search failed: ${error.message}</p>`;
        showErrorNotification(`Search failed for "${query}".`);
    }
}

function showBlockDetails(block, container) {
    const targetContainer = container || document.getElementById('blockDetailsContainer'); // Example container
    if (!targetContainer) return;
    if (block) {
        targetContainer.innerHTML = `<h4>Block ${block.number}</h4>
            <p><strong>Hash:</strong> ${block.hash}</p>
            <p><strong>Parent Hash:</strong> ${block.parentHash}</p>
            <p><strong>Timestamp:</strong> ${new Date(block.timestamp).toLocaleString()}</p>
            <p><strong>Transactions:</strong> ${block.transactions}</p>
            <p><strong>Validator:</strong> ${block.validator || 'N/A'}</p>`;
    } else {
        targetContainer.innerHTML = '<p class="error">Block not found.</p>';
    }
}

function showTransactionDetails(tx, container) {
    const targetContainer = container || document.getElementById('transactionDetailsContainer');
    if (!targetContainer) return;
    if (tx) {
        targetContainer.innerHTML = `<h4>Transaction ${tx.hash.substring(0,15)}...</h4>
            <p><strong>Block Number:</strong> ${tx.blockNumber}</p>
            <p><strong>From:</strong> ${tx.from || tx.signer || 'N/A'}</p>
            <p><strong>To:</strong> ${tx.to || (tx.args && tx.args[0] ? tx.args[0].Id || tx.args[0] : 'N/A')}</p>
            <p><strong>Value:</strong> ${tx.value || (tx.args && tx.args[1] ? tx.args[1] : 'N/A')}</p>
            <p><strong>Method:</strong> ${tx.method}</p>`;
    } else {
        targetContainer.innerHTML = '<p class="error">Transaction not found.</p>';
    }
}

function showAccountDetails(account, container) {
    const targetContainer = container || document.getElementById('accountDetailsContainer');
    if (!targetContainer) return;
    if (account) {
        targetContainer.innerHTML = `<h4>Account ${account.address.substring(0,15)}...</h4>
            <p><strong>Balance:</strong> ${(parseFloat(account.balance) / Math.pow(10, polkadotConnector?.api?.registry.chainDecimals[0] || 12)).toFixed(4)} ${polkadotConnector?.api?.registry.chainTokens[0] || 'UNIT'}</p>
            <p><strong>Nonce:</strong> ${account.nonce}</p>
            <p><strong>Transactions:</strong> ${account.transactions}</p>`; // Note: 'transactions' count is often N/A
    } else {
        targetContainer.innerHTML = '<p class="error">Account not found.</p>';
    }
}

async function handleConnectWallet() {
    console.log('Attempting to connect wallet...');
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    if (connectWalletBtn) {
        connectWalletBtn.disabled = true;
        connectWalletBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    }

    try {
        if (!polkadotConnector) throw new Error("Polkadot Connector not initialized.");
        
        const walletInfo = await polkadotConnector.connectWallet(); // connectWallet now returns { address, name, source }
        connectedWallet = walletInfo; // Store wallet info globally

        const walletStatus = document.getElementById('walletStatus');
        const walletAddressEl = document.getElementById('walletAddress');
        if (walletStatus && walletAddressEl) {
            walletStatus.style.display = 'block';
            walletAddressEl.textContent = `${walletInfo.name || 'Unnamed Account'} (${walletInfo.address.substring(0, 6)}...${walletInfo.address.substring(walletInfo.address.length - 4)})`;
        }
        if (connectWalletBtn) {
            connectWalletBtn.innerHTML = 'Wallet Connected';
            connectWalletBtn.classList.replace('btn-primary', 'btn-success');
        }
        showSuccessNotification(`Wallet connected: ${walletInfo.name || walletInfo.address}`);
    } catch (error) {
        console.error('Error connecting wallet:', error);
        if (connectWalletBtn) {
            connectWalletBtn.innerHTML = 'Connect Wallet';
            connectWalletBtn.disabled = false;
        }
        showErrorNotification(`Failed to connect wallet: ${error.message}`);
        connectedWallet = null;
    } finally {
         if (connectWalletBtn) connectWalletBtn.disabled = false;
    }
}

async function handleDeployContract() {
    console.log('Attempting to deploy contract...');
    if (!contractDeployer || !polkadotConnector || !polkadotConnector.isConnected()) {
        showErrorNotification('Not connected or deployer not ready.');
        return;
    }
    if (!connectedWallet) {
        showErrorNotification('Please connect your wallet first to deploy a contract.');
        return;
    }

    const deployContractBtn = document.getElementById('deployContractBtn');
    const deploymentStatusEl = document.getElementById('deploymentStatusText'); // Assuming an element for status text
    const deploymentLogEl = document.getElementById('deploymentLog');

    // UI elements for contract ABI and WASM
    const contractAbiInput = document.getElementById('contractAbiInput'); // Assuming new ID for ABI
    const contractWasmInput = document.getElementById('contractWasmInput'); // Assuming new ID for WASM
    const constructorArgsInput = document.getElementById('constructorArgs');
    const gasLimitInput = document.getElementById('gasLimit');
    
    const abi = contractAbiInput?.value;
    const wasmHex = contractWasmInput?.value; // Should be 0x prefixed hex
    const constructorArgsStr = constructorArgsInput?.value;
    const gasLimit = gasLimitInput?.value;

    if (!abi || !wasmHex) {
        showErrorNotification('ABI and WASM Hex code are required.');
        return;
    }

    let parsedArgs = [];
    try {
        if (constructorArgsStr) parsedArgs = JSON.parse(constructorArgsStr);
    } catch (e) {
        showErrorNotification('Invalid constructor arguments JSON format.');
        return;
    }

    if (deployContractBtn) {
        deployContractBtn.disabled = true;
        deployContractBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deploying...';
    }
    if (deploymentStatusEl) deploymentStatusEl.textContent = 'Deploying...';
    if (deploymentLogEl) deploymentLogEl.innerHTML = `<p>[${new Date().toLocaleTimeString()}] Starting deployment...</p>`;

    try {
        const contractData = { abi: JSON.parse(abi), wasm: wasmHex };
        const deployOptions = {
            deployerAddress: connectedWallet.address,
            signerCredentials: { source: connectedWallet.source }, // For extension signing
            constructorArgs: parsedArgs,
            gasLimit: polkadotConnector.api.registry.createType('WeightV2', {
                refTime: new BN(gasLimit || '200000000000'), // Default if not provided
                proofSize: new BN('2000000') // Default
            })
            // storageDepositLimit, value, salt can be added if needed
        };

        const result = await contractDeployer.deployContract(contractData, deployOptions);
        
        if (deploymentLogEl) {
            deploymentLogEl.innerHTML += `<p class="success">[${new Date().toLocaleTimeString()}] Contract deployed successfully!</p>
                                         <p>Address: ${result.address}</p>
                                         <p>Block Hash: ${result.deploymentData.blockHash}</p>`;
        }
        if (deploymentStatusEl) deploymentStatusEl.textContent = 'Deployment successful!';
        showSuccessNotification(`Contract deployed at ${result.address}`);

    } catch (error) {
        console.error('Error deploying contract:', error);
        if (deploymentLogEl) deploymentLogEl.innerHTML += `<p class="error">[${new Date().toLocaleTimeString()}] Deployment failed: ${error.message}</p>`;
        if (deploymentStatusEl) deploymentStatusEl.textContent = 'Deployment failed.';
        showErrorNotification(`Deployment failed: ${error.message}`);
    } finally {
        if (deployContractBtn) {
            deployContractBtn.disabled = false;
            deployContractBtn.innerHTML = 'Deploy Contract';
        }
    }
}

function loadContractTemplate(templateName) {
    console.log('Loading contract template:', templateName);
    const contractAbiInput = document.getElementById('contractAbiInput');
    const contractWasmInput = document.getElementById('contractWasmInput');
    // const contractTypeSelect = document.getElementById('contractType'); // If you have a type selector

    if (!contractAbiInput || !contractWasmInput) {
        showErrorNotification("ABI/WASM input fields not found.");
        return;
    }

    const template = contractDeployer.getContractTemplates().find(t => t.id === templateName);
    if (!template) {
        showErrorNotification(`Template "${templateName}" not found.`);
        return;
    }

    // For real deployment, these should be pre-compiled ABI (JSON) and WASM (hex)
    // The current templates in contract-deployer.js have source code.
    // We will put placeholders here and instruct user.
    let placeholderAbi = `/* Replace with actual ABI JSON for ${template.name} */ {}`;
    let placeholderWasmHex = `/* Replace with actual 0x-prefixed WASM hex for ${template.name} */ "0x"`;
    
    // Example for Flipper (if you had precompiled versions)
    if (templateName === 'flipper') {
        placeholderAbi = JSON.stringify({
            "constructors": [ { "args": [ { "label": "init_value", "type": { "displayName": [ "bool" ], "type": 0 } } ], "docs": [], "label": "new", "payable": false, "returnType": null, "selector": "0x9bae9d5e" } ],
            "docs": [], "events": [],
            "messages": [ { "args": [], "docs": [], "label": "flip", "mutates": true, "payable": false, "returnType": null, "selector": "0x633aa551" }, { "args": [], "docs": [], "label": "get", "mutates": false, "payable": false, "returnType": { "displayName": [ "bool" ], "type": 0 }, "selector": "0x2f865bd9" } ],
            "metadataVersion": "0.1.0", "source": { "hash": "0x...", "language": "ink! 4.0.0", "compiler": "rustc 1.69.0-nightly" }, "contract": { "name": "flipper", "version": "0.1.0", "authors": [ "[your_name] <[your_email]>" ] }
        }, null, 2); // Pretty print JSON
        placeholderWasmHex = "0x0061736d0100000001... (truncated actual flipper WASM hex) ...00"; // Use a real, (even short) valid hex if possible
    }
    
    contractAbiInput.value = placeholderAbi;
    contractWasmInput.value = placeholderWasmHex;
    // if (contractTypeSelect) contractTypeSelect.value = template.language; // if you have ink/evm selector

    const contractSourceCodeDisplay = document.getElementById('contractSourceCodeDisplay'); // Optional element to show source
    if(contractSourceCodeDisplay) {
        contractSourceCodeDisplay.textContent = template.source; // Display original source for reference
        contractSourceCodeDisplay.innerHTML += `<p class="warning">Note: The above is source code. Please compile it and paste the ABI JSON and WASM Hex into the respective fields above for deployment.</p>`;
    }

    showSuccessNotification(`${template.name} template loaded. Please provide compiled ABI and WASM Hex.`);
}

function runContractInSandbox() {
    // This remains a simulation as client-side compilation is out of scope
    console.log('Running contract in sandbox (simulation)...');
    const contractLanguage = document.getElementById('contractLanguage')?.value;
    const contractCodeEditor = document.getElementById('contractEditor');
    const contractOutput = document.getElementById('contractOutput');
    
    if (!contractCodeEditor || !contractOutput) return;
    const code = contractCodeEditor.value || contractCodeEditor.textContent; // For textarea or div

    if (!code) {
        contractOutput.innerHTML = '<p class="error">No code to run in sandbox.</p>';
        return;
    }
    contractOutput.innerHTML = '<p>Simulating contract execution...</p>';
    setTimeout(() => {
        contractOutput.innerHTML = `<p class="success">Sandbox execution simulated for ${contractLanguage || 'selected'} contract.</p>
                                    <pre>Output: OK\nGas used: 10000</pre>`;
    }, 1500);
}

function startBasicsQuizHandler() {
    // Simple client-side quiz rendering
    console.log('Starting basics quiz...');
    const basicsQuizContainer = document.getElementById('basicsQuiz');
    if (!basicsQuizContainer) return;
    // Simplified quiz UI generation
    basicsQuizContainer.innerHTML = `
        <h4>What is Polkadot's native token?</h4>
        <input type="radio" name="q1_basics" value="ETH"> ETH <br>
        <input type="radio" name="q1_basics" value="DOT"> DOT <br>
        <input type="radio" name="q1_basics" value="BTC"> BTC <br>
        <button id="submitBasicsQuiz" class="btn btn-secondary">Submit</button>
        <div id="basicsQuizResult"></div>`;
    
    document.getElementById('submitBasicsQuiz')?.addEventListener('click', () => {
        const answer = document.querySelector('input[name="q1_basics"]:checked')?.value;
        const resultEl = document.getElementById('basicsQuizResult');
        if(resultEl) resultEl.textContent = (answer === 'DOT') ? 'Correct!' : 'Incorrect. The answer is DOT.';
    });
}

function loadArchitectureDiagramHandler() {
    console.log('Loading architecture diagram...');
    const diagramContainer = document.getElementById('architectureDiagram');
    if (!diagramContainer) return;
    diagramContainer.innerHTML = `<img src="assets/polkadot-architecture.png" alt="Polkadot Architecture" style="max-width:100%;">
                                 <p>Interactive elements for Relay Chain, Parachains, Bridges would go here.</p>`;
    // Actual interactive diagram elements would be more complex
}

function startCrossChainDemoHandler() {
    // Simple simulated cross-chain transfer
    console.log('Starting cross-chain demo (simulation)...');
    const demoContainer = document.getElementById('crossChainDemo');
    if (!demoContainer) return;
    demoContainer.innerHTML = `<p>Simulating cross-chain transfer from Parachain A to Parachain B...</p>
                               <p>Status: Transfer initiated...</p>
                               <p>Status: Transfer successful!</p>`;
}

function startLearningModule(moduleId) {
    console.log(`Starting learning module: ${moduleId}`);
    // Navigate to the learning content for moduleId, e.g., by showing a specific div or loading content.
    // Since Firebase is disabled, progress tracking isn't implemented.
    showSuccessNotification(`Navigating to ${moduleId} module.`);
    // Example: show specific content section
    document.querySelectorAll('.learning-module-content').forEach(el => el.style.display = 'none');
    const moduleEl = document.getElementById(`module-${moduleId}-content`);
    if(moduleEl) moduleEl.style.display = 'block';
    else showErrorNotification(`Content for module ${moduleId} not found.`);
}

async function handleNetworkChange(event) {
    const selectedNetworkId = event.target.value;
    const selectedNetwork = blockchainSelector.getAvailableNetworks().find(n => n.id === selectedNetworkId);

    if (!selectedNetwork) {
        showErrorNotification(`Network ${selectedNetworkId} not found.`);
        return;
    }

    console.log(`Changing network to: ${selectedNetwork.name} (${selectedNetwork.endpoint})`);
    showSuccessNotification(`Connecting to ${selectedNetwork.name}...`);

    try {
        // Disconnect existing connector if any
        if (polkadotConnector && polkadotConnector.isConnected()) {
            await polkadotConnector.disconnect();
        }
        
        // Create and connect new connector
        polkadotConnector = new PolkadotConnector({ networkEndpoint: selectedNetwork.endpoint });
        polkadotConnector.addConnectionListener(handleConnectionStatusChange); // Re-add listener
        
        await polkadotConnector.connect();
        // blockchainSelector and contractDeployer will be updated via handleConnectionStatusChange

    } catch (error) {
        console.error(`Failed to switch to network ${selectedNetwork.name}:`, error);
        showErrorNotification(`Failed to switch to ${selectedNetwork.name}: ${error.message}`);
        // Optionally, try to revert to a default/previous connection or handle UI state
    }
}

function populateNetworkSelector() {
    const networkSelect = document.getElementById('networkSelect');
    if (!networkSelect || !blockchainSelector) return;

    const networks = blockchainSelector.getAvailableNetworks();
    networkSelect.innerHTML = networks.map(network => 
        `<option value="${network.id}">${network.name} (${network.description})</option>`
    ).join('');

    // Set selected based on current connector's endpoint if possible
    if (polkadotConnector && polkadotConnector.networkEndpoint) {
        const currentNet = networks.find(n => n.endpoint === polkadotConnector.networkEndpoint);
        if (currentNet) {
            networkSelect.value = currentNet.id;
        }
    }
}

function clearBlockchainDataDisplay() {
    const tablesToClear = ['blocksTable', 'transactionsTable', 'accountsTable', 'validatorsTable'];
    tablesToClear.forEach(tableId => {
        const tableBody = document.querySelector(`#${tableId} tbody`);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center">Disconnected. Please select a network.</td></tr>`;
        }
    });
     const searchResultsEl = document.getElementById('explorerSearchResults');
    if(searchResultsEl) searchResultsEl.innerHTML = "";
}


// Utility for notifications
function showSuccessNotification(message) {
    console.log('SUCCESS:', message);
    // In a real app, you'd use a toast library or custom UI element.
    alert(`SUCCESS: ${message}`);
}

function showErrorNotification(message) {
    console.error('ERROR:', message);
    alert(`ERROR: ${message}`);
}