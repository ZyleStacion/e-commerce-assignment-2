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
            renderCoinremitterButtons();
            console.log('Coinremitter initialized with currencies:', availableCryptos);
        } else {
            throw new Error('Coinremitter not available');
        }
        
    } catch (error) {
        console.error('Error initializing Coinremitter:', error);
        showCoinremitterError();
    }
}

function renderCoinremitterButtons() {
    const container = document.getElementById('crypto-button-container');
    if (!container) {
        console.error('Crypto container not found');
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
            
            <div style="text-align: center; margin-top: 25px;">
                <button onclick="checkPaymentStatus('${invoice.invoice_id}')" class="btn btn-warning btn-lg" style="margin-right: 10px;">
                    🔍 Check Payment Status
                </button>
                <button onclick="cancelCryptoPayment()" class="btn btn-secondary">
                    ❌ Cancel
                </button>
            </div>
            
            <div id="payment-status-${invoice.invoice_id}" style="margin-top: 20px;"></div>
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
            
            if (status === 'paid' || status === 'confirmed') {
                // Payment successful
                clearInterval(window.countdownInterval);
                clearInterval(window.paymentStatusInterval);
                
                statusDiv.innerHTML = `
                    <div style="background: #d4edda; border: 2px solid #28a745; color: #155724; padding: 15px; border-radius: 8px; text-align: center;">
                        <h5>✅ Payment Confirmed!</h5>
                        <p>Transaction Hash: <code>${data.transactionHash || 'N/A'}</code></p>
                        <p>Redirecting to success page...</p>
                    </div>
                `;
                
                setTimeout(() => {
                    window.location.href = `/success?payment=crypto&crypto=${data.crypto || ''}&txn=${data.transactionHash || invoiceId}`;
                }, 3000);
                
            } else if (status === 'pending') {
                statusDiv.innerHTML = `
                    <div style="background: #fff3cd; border: 2px solid #ffc107; color: #856404; padding: 15px; border-radius: 8px; text-align: center;">
                        <strong>⏳ Payment detected, waiting for blockchain confirmation...</strong>
                        <p>Confirmations: ${data.confirmations || 0}</p>
                    </div>
                `;
            } else if (status === 'expired') {
                clearInterval(window.countdownInterval);
                clearInterval(window.paymentStatusInterval);
                
                statusDiv.innerHTML = `
                    <div style="background: #f8d7da; border: 2px solid #dc3545; color: #721c24; padding: 15px; border-radius: 8px; text-align: center;">
                        <strong>❌ Payment expired</strong>
                        <p>Please create a new payment.</p>
                    </div>
                `;
            }
        } else {
            statusDiv.innerHTML = `
                <div style="background: #f8d7da; border: 2px solid #dc3545; color: #721c24; padding: 15px; border-radius: 8px; text-align: center;">
                    <strong>❌ Error checking payment status</strong>
                    <p>${data.error || 'Unknown error'}</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error checking payment status:', error);
    }
}

function cancelCryptoPayment() {
    clearInterval(window.countdownInterval);
    clearInterval(window.paymentStatusInterval);
    renderCoinremitterButtons();
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