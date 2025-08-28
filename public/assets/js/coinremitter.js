// Coinremitter Cryptocurrency Payment Integration

let coinremitterInitialized = false;
let availableCryptos = ['BTC', 'ETH', 'LTC', 'DOGE', 'USDT'];

async function initializeCoinremitterPayment() {
    try {
        console.log('Initializing Coinremitter cryptocurrency payments...');
        
        // Check if cryptocurrency payments are available
        const response = await fetch('/api/coinremitter/check-availability');
        const data = await response.json();
        
        if (data.success) {
            coinremitterInitialized = true;
            availableCryptos = data.availableCryptos || availableCryptos;
            console.log('Coinremitter initialized with currencies:', availableCryptos);
            // Don't render buttons automatically - wait for user to select crypto payment
        } else {
            throw new Error('Coinremitter not available');
        }
        
    } catch (error) {
        console.error('Error initializing Coinremitter:', error);
        // Don't show error automatically
        coinremitterInitialized = false;
    }
}

function renderCoinremitterButtons() {
    const container = document.getElementById('crypto-button-container');
    if (!container) {
        console.error('Crypto container not found');
        return;
    }
    
    // Check if coinremitter is initialized
    if (!coinremitterInitialized) {
        showCoinremitterError();
        return;
    }
    
    let buttonsHtml = '<h5 style="margin-bottom: 15px; color: #333;">💰 Pay with Cryptocurrency</h5>';
    
    availableCryptos.forEach(crypto => {
        const cryptoInfo = getCryptoInfo(crypto);
        buttonsHtml += `
            <button 
                class="btn btn-outline-warning btn-block crypto-btn" 
                onclick="startCryptoPayment('${crypto}')"
                style="margin: 8px 0; display: flex; align-items: center; justify-content: center; border: 2px solid #ffc107; padding: 12px;">
                <span style="margin-right: 10px; font-size: 18px;">${cryptoInfo.icon}</span>
                <strong>Pay with ${cryptoInfo.name} (${crypto})</strong>
            </button>
        `;
    });
    
    container.innerHTML = buttonsHtml;
    container.style.display = 'block';
}

function hideCoinremitterButtons() {
    const container = document.getElementById('crypto-button-container');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
    
    // Clear any active payment intervals
    if (window.paymentStatusInterval) {
        clearInterval(window.paymentStatusInterval);
    }
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
}

function getCryptoInfo(crypto) {
    const cryptoData = {
        'BTC': { name: 'Bitcoin', icon: '₿' },
        'ETH': { name: 'Ethereum', icon: 'Ξ' },
        'LTC': { name: 'Litecoin', icon: 'Ł' },
        'DOGE': { name: 'Dogecoin', icon: 'Ð' },
        'USDT': { name: 'Tether', icon: '₮' }
    };
    
    return cryptoData[crypto] || { name: crypto, icon: '₿' };
}

async function startCryptoPayment(cryptocurrency) {
    try {
        console.log(`Starting ${cryptocurrency} payment...`);
        
        const total = window.CART_TOTAL || 10.00;
        
        // Show loading state
        showCryptoLoading(cryptocurrency);
        
        // Create cryptocurrency invoice
        const response = await fetch('/api/coinremitter/create-invoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: total,
                currency: 'USD',
                crypto: cryptocurrency,
                orderId: 'ORDER_' + Date.now()
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.invoice) {
            // Show payment details to user
            showCryptoPaymentDetails(data.invoice, cryptocurrency);
        } else {
            throw new Error(data.error || 'Failed to create cryptocurrency invoice');
        }
        
    } catch (error) {
        console.error(`Error creating ${cryptocurrency} payment:`, error);
        alert(`Failed to create ${cryptocurrency} payment. Please try again.`);
        renderCoinremitterButtons(); // Reset buttons
    }
}

function showCryptoLoading(crypto) {
    const container = document.getElementById('crypto-button-container');
    container.innerHTML = `
        <div style="text-align: center; padding: 30px; background: #f8f9fa; border-radius: 8px;">
            <div class="spinner-border text-warning" role="status">
                <span class="sr-only">Loading...</span>
            </div>
            <p style="margin-top: 15px; font-weight: 500;">Creating ${crypto} payment invoice...</p>
        </div>
    `;
}

function showCryptoPaymentDetails(invoice, crypto) {
    const container = document.getElementById('crypto-button-container');
    const cryptoInfo = getCryptoInfo(crypto);
    
    container.innerHTML = `
        <div class="crypto-payment-details" style="border: 2px solid #ffc107; padding: 25px; border-radius: 12px; background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);">
            <h4 style="color: #856404; margin-bottom: 20px;">
                ${cryptoInfo.icon} ${cryptoInfo.name} Payment
            </h4>
            
            <div style="margin: 20px 0; padding: 15px; background: white; border-radius: 8px; border: 1px solid #ffeaa7;">
                <strong style="color: #333;">Amount to Pay:</strong>
                <div style="font-size: 24px; color: #f39c12; font-weight: bold; margin-top: 5px;">
                    ${invoice.total_amount} ${crypto}
                </div>
                <small style="color: #666;">≈ $${window.CART_TOTAL || '10.00'} USD</small>
            </div>
            
            <div style="margin: 20px 0;">
                <strong style="color: #333;">Send to this ${crypto} Address:</strong>
                <div style="background: #fff; padding: 15px; border: 2px solid #28a745; border-radius: 8px; font-family: 'Courier New', monospace; word-break: break-all; font-size: 14px; margin-top: 8px;">
                    ${invoice.address}
                </div>
                <button onclick="copyToClipboard('${invoice.address}')" class="btn btn-success btn-sm" style="margin-top: 8px;">
                    📋 Copy Address
                </button>
            </div>
            
            <div style="margin: 20px 0; text-align: center;">
                <div style="background: white; padding: 15px; border-radius: 8px; display: inline-block;">
                    <img src="${invoice.qr_code}" alt="QR Code" style="max-width: 200px; height: auto;">
                    <p style="margin-top: 10px; margin-bottom: 0;"><small><strong>📱 Scan with your crypto wallet</strong></small></p>
                </div>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 8px; text-align: center;">
                <strong style="color: #856404;">⏰ Payment expires in: <span id="countdown-${invoice.invoice_id}" style="color: #d63384; font-size: 18px;">15:00</span></strong>
            </div>
            
            <!-- Manual Transaction Verification Section -->
            <div id="manual-verification-${invoice.invoice_id}" style="margin: 20px 0; padding: 15px; background: #e7f3ff; border: 2px solid #0066cc; border-radius: 8px; display: none;">
                <h6 style="color: #004499; margin-bottom: 10px;">🔍 Already sent payment? Verify your transaction:</h6>
                <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                    <input 
                        type="text" 
                        id="txn-hash-${invoice.invoice_id}" 
                        placeholder="Enter transaction hash (e.g., 0x1234...)" 
                        style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; font-size: 12px;"
                    >
                    <button 
                        onclick="verifyManualTransaction('${invoice.invoice_id}')" 
                        class="btn btn-primary btn-sm">
                        Verify
                    </button>
                </div>
                <small style="color: #666;">
                    Enter your transaction hash to instantly verify payment
                </small>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <button onclick="checkPaymentStatus('${invoice.invoice_id}')" class="btn btn-warning btn-lg" style="margin-right: 10px;">
                    🔍 Check Payment Status
                </button>
                <button onclick="showManualVerification('${invoice.invoice_id}')" class="btn btn-info" style="margin-right: 10px;">
                    📝 I Sent Payment
                </button>
                <button onclick="cancelCryptoPayment()" class="btn btn-secondary">
                    ❌ Cancel
                </button>
            </div>
            
            <div id="payment-status-${invoice.invoice_id}" style="margin-top: 20px;"></div>
            <div id="verification-status-${invoice.invoice_id}" style="margin-top: 15px;"></div>
        </div>
    `;
    
    // Start countdown timer
    startPaymentCountdown(invoice.invoice_id, 15 * 60); // 15 minutes
    
    // Auto-check payment status every 30 seconds
    window.paymentStatusInterval = setInterval(() => {
        checkPaymentStatus(invoice.invoice_id);
    }, 30000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Address copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('✅ Address copied to clipboard!');
    });
}

function startPaymentCountdown(invoiceId, seconds) {
    const countdownElement = document.getElementById(`countdown-${invoiceId}`);
    
    window.countdownInterval = setInterval(() => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        countdownElement.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        
        if (seconds <= 0) {
            clearInterval(window.countdownInterval);
            clearInterval(window.paymentStatusInterval);
            countdownElement.textContent = 'EXPIRED';
            alert('⏰ Payment time expired. Please create a new payment.');
            renderCoinremitterButtons();
        }
        
        seconds--;
    }, 1000);
}

async function checkPaymentStatus(invoiceId) {
    try {
        const response = await fetch(`/api/coinremitter/payment-status/${invoiceId}`);
        const data = await response.json();
        
        const statusDiv = document.getElementById(`payment-status-${invoiceId}`);
        
        if (data.success) {
            const status = data.status;
            
            if (status === 'confirmed' && data.payment_verified) {
                // ✅ PAYMENT PASSED
                clearInterval(window.countdownInterval);
                clearInterval(window.paymentStatusInterval);
                
                statusDiv.innerHTML = `
                    <div style="background: #d4edda; border: 2px solid #28a745; color: #155724; padding: 15px; border-radius: 8px; text-align: center;">
                        <h5>✅ PAYMENT VERIFIED - PASS!</h5>
                        <p><strong>Status:</strong> Payment Confirmed</p>
                        <p><strong>Confirmations:</strong> ${data.confirmations}/${data.confirmations_required}</p>
                        <p><strong>Network:</strong> ${data.network}</p>
                        ${data.transactionHash ? `<p><strong>Transaction:</strong> <code style="word-break: break-all; font-size: 11px;">${data.transactionHash}</code></p>` : ''}
                        <p><strong>Verification Attempts:</strong> ${data.verification_attempts}</p>
                        <p style="margin-top: 10px; font-weight: bold;">Redirecting to success page...</p>
                    </div>
                `;
                
                setTimeout(() => {
                    window.location.href = `/success?payment=crypto&crypto=${data.crypto}&txn=${data.transactionHash}&verified=true`;
                }, 5000);
                
            } else if (status === 'pending') {
                statusDiv.innerHTML = `
                    <div style="background: #fff3cd; border: 2px solid #ffc107; color: #856404; padding: 15px; border-radius: 8px; text-align: center;">
                        <h6>⏳ VERIFICATION IN PROGRESS</h6>
                        <p><strong>Status:</strong> Payment detected, verifying...</p>
                        <p><strong>Confirmations:</strong> ${data.confirmations || 0}/${data.confirmations_required}</p>
                        <p><strong>Attempts:</strong> ${data.verification_attempts}</p>
                        <small>Last checked: ${new Date(data.last_verified).toLocaleTimeString()}</small>
                    </div>
                `;
            } else if (status === 'waiting') {
                statusDiv.innerHTML = `
                    <div style="background: #cce7ff; border: 2px solid #0066cc; color: #004499; padding: 15px; border-radius: 8px; text-align: center;">
                        <h6>🔍 SCANNING FOR PAYMENT</h6>
                        <p><strong>Status:</strong> Waiting for transaction</p>
                        <p><strong>Address:</strong> Monitoring blockchain</p>
                        <p><strong>Attempts:</strong> ${data.verification_attempts}</p>
                        ${data.failure_reason ? `<p style="color: #dc3545;"><strong>Note:</strong> ${data.failure_reason}</p>` : ''}
                    </div>
                `;
            } else if (status === 'expired') {
                // ❌ PAYMENT FAILED - EXPIRED
                clearInterval(window.countdownInterval);
                clearInterval(window.paymentStatusInterval);
                
                statusDiv.innerHTML = `
                    <div style="background: #f8d7da; border: 2px solid #dc3545; color: #721c24; padding: 15px; border-radius: 8px; text-align: center;">
                        <h5>❌ PAYMENT FAILED - EXPIRED</h5>
                        <p><strong>Reason:</strong> ${data.failure_reason || 'Payment window expired'}</p>
                        <p><strong>Final Status:</strong> Transaction not received in time</p>
                        <p><strong>Verification Attempts:</strong> ${data.verification_attempts}</p>
                        <p style="margin-top: 10px;">Please create a new payment.</p>
                    </div>
                `;
            }
        } else {
            // ❌ PAYMENT FAILED - ERROR
            statusDiv.innerHTML = `
                <div style="background: #f8d7da; border: 2px solid #dc3545; color: #721c24; padding: 15px; border-radius: 8px; text-align: center;">
                    <h5>❌ VERIFICATION FAILED</h5>
                    <p><strong>Error:</strong> ${data.error || 'Payment verification failed'}</p>
                    <p>Please try again or contact support.</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error checking payment status:', error);
        const statusDiv = document.getElementById(`payment-status-${invoiceId}`);
        statusDiv.innerHTML = `
            <div style="background: #f8d7da; border: 2px solid #dc3545; color: #721c24; padding: 15px; border-radius: 8px; text-align: center;">
                <h5>❌ CONNECTION FAILED</h5>
                <p>Unable to verify payment status. Please check your connection.</p>
            </div>
        `;
    }
}

function cancelCryptoPayment() {
    clearInterval(window.countdownInterval);
    clearInterval(window.paymentStatusInterval);
    hideCoinremitterButtons();
}

function showCoinremitterError() {
    const container = document.getElementById('crypto-button-container');
    if (container) {
        container.innerHTML = `
            <div style="padding: 20px; background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; color: #721c24;">
                <h5>❌ Cryptocurrency Payments Unavailable</h5>
                <p>Service is currently not configured. Please use PayPal, Google Pay, or Stripe instead.</p>
            </div>
        `;
        container.style.display = 'block';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Coinremitter cryptocurrency payment script loaded');
    initializeCoinremitterPayment();
});

// ===== MANUAL TRANSACTION VERIFICATION FUNCTIONS =====

function showManualVerification(invoiceId) {
    const manualDiv = document.getElementById(`manual-verification-${invoiceId}`);
    if (manualDiv) {
        manualDiv.style.display = 'block';
        // Focus on the input field
        setTimeout(() => {
            const input = document.getElementById(`txn-hash-${invoiceId}`);
            if (input) input.focus();
        }, 100);
    }
}

async function verifyManualTransaction(invoiceId) {
    const input = document.getElementById(`txn-hash-${invoiceId}`);
    const verificationDiv = document.getElementById(`verification-status-${invoiceId}`);
    
    if (!input || !input.value.trim()) {
        alert('Please enter a transaction hash');
        return;
    }
    
    const transactionHash = input.value.trim();
    
    // Show loading state
    verificationDiv.innerHTML = `
        <div style="background: #e7f3ff; border: 2px solid #0066cc; color: #004499; padding: 15px; border-radius: 8px; text-align: center;">
            <h6>🔍 VERIFYING TRANSACTION...</h6>
            <p>Checking blockchain for: <code style="word-break: break-all; font-size: 11px;">${transactionHash}</code></p>
            <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="sr-only">Loading...</span>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch('/api/coinremitter/verify-transaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                invoiceId: invoiceId,
                transactionHash: transactionHash
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.verified) {
            // ✅ MANUAL VERIFICATION PASSED
            verificationDiv.innerHTML = `
                <div style="background: #d4edda; border: 2px solid #28a745; color: #155724; padding: 15px; border-radius: 8px; text-align: center;">
                    <h5>✅ TRANSACTION VERIFIED - PASS!</h5>
                    <p><strong>Transaction Hash:</strong> <code style="word-break: break-all; font-size: 11px;">${transactionHash}</code></p>
                    <p><strong>Status:</strong> ${data.status}</p>
                    <p><strong>Confirmations:</strong> ${data.confirmations}</p>
                    <p style="margin-top: 10px; font-weight: bold;">Payment verified successfully!</p>
                </div>
            `;
            
            // Hide manual verification section
            const manualDiv = document.getElementById(`manual-verification-${invoiceId}`);
            if (manualDiv) {
                manualDiv.style.display = 'none';
            }
            
            // Redirect to success page after showing result for longer
            setTimeout(() => {
                window.location.href = `/success?payment=crypto&txn=${transactionHash}&verified=true&method=manual`;
            }, 5000);
            
        } else {
            // ❌ MANUAL VERIFICATION FAILED
            verificationDiv.innerHTML = `
                <div style="background: #f8d7da; border: 2px solid #dc3545; color: #721c24; padding: 15px; border-radius: 8px; text-align: center;">
                    <h5>❌ TRANSACTION VERIFICATION FAILED</h5>
                    <p><strong>Transaction Hash:</strong> <code style="word-break: break-all; font-size: 11px;">${transactionHash}</code></p>
                    <p><strong>Error:</strong> ${data.error || data.message || 'Transaction not found or invalid'}</p>
                    <p style="margin-top: 10px;">Please check the transaction hash and try again.</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error verifying transaction:', error);
        verificationDiv.innerHTML = `
            <div style="background: #f8d7da; border: 2px solid #dc3545; color: #721c24; padding: 15px; border-radius: 8px; text-align: center;">
                <h5>❌ VERIFICATION ERROR</h5>
                <p>Unable to verify transaction. Please try again.</p>
            </div>
        `;
    }
}