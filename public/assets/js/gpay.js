//=============================================================================
// Configuration
//=============================================================================

// The DOM element that the Google Pay button will be rendered into
const GPAY_BUTTON_CONTAINER_ID = 'gpay-container';

// Update the `merchantId` and `merchantName` properties with your own values.
// Your real info is required when the environment is `PRODUCTION`.
const merchantInfo = {
  merchantId: '12345678901234567890',
  merchantName: 'Example Merchant'
};

// This is the base configuration for all Google Pay payment data requests.
const baseGooglePayRequest = {
  apiVersion: 2,
  apiVersionMinor: 0,
  allowedPaymentMethods: [
    {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: [
          "PAN_ONLY", "CRYPTOGRAM_3DS"
        ],
        allowedCardNetworks: [
          "AMEX", "DISCOVER", "INTERAC", "JCB", "MASTERCARD", "VISA"
        ]
      },
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: {
          gateway: 'example',
          gatewayMerchantId: 'exampleGatewayMerchantId'
        }
      }
    }
  ],
  merchantInfo
};

// Prevent accidental edits to the base configuration. Mutations will be
// handled by cloning the config using deepCopy() and modifying the copy.
Object.freeze(baseGooglePayRequest);

//=============================================================================
// Google Payments client singleton
//=============================================================================

let paymentsClient = null;

function getGooglePaymentsClient() {
  if (paymentsClient === null) {
    paymentsClient = new google.payments.api.PaymentsClient({
      environment: 'TEST',
      merchantInfo,
      // todo: paymentDataCallbacks (codelab pay-web-201)
    });
  }

  return paymentsClient;
}

//=============================================================================
// Helpers
//=============================================================================

const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

function renderGooglePayButton() {
  const button = getGooglePaymentsClient().createButton({
    onClick: onGooglePaymentButtonClicked
  });

  document.getElementById(GPAY_BUTTON_CONTAINER_ID).appendChild(button);
}

//=============================================================================
// Event Handlers
//=============================================================================

function onGooglePayLoaded() {
  const req = deepCopy(baseGooglePayRequest);

  getGooglePaymentsClient()
    .isReadyToPay(req)
    .then(function(res) {
      if (res.result) {
        // Store the readiness state, but don't render the button yet
        window.googlePayReady = true;
        console.log("Google Pay is ready for this user.");
      } else {
        console.log("Google Pay is not ready for this user.");
        window.googlePayReady = false;
      }
    })
    .catch(console.error);
}

function onGooglePaymentButtonClicked() {
  // Get cart total from the checkout page (if available)
  let cartTotal = '10.00'; // Default fallback
  if (typeof calculateCartTotal === 'function') {
    cartTotal = calculateCartTotal().toFixed(2);
  } else if (typeof CART_TOTAL !== 'undefined') {
    cartTotal = CART_TOTAL.toFixed(2);
  }
  
  // Create a new request data object for this request
  const req = {
    ...deepCopy(baseGooglePayRequest),
    transactionInfo: {
      countryCode: 'US',
      currencyCode: 'USD',
      totalPriceStatus: 'FINAL',
      totalPrice: cartTotal,
    },
    // todo: callbackIntents (codelab gpay-web-201)
  };

  // Write request object to console for debugging
  console.log(req);

  getGooglePaymentsClient()
    .loadPaymentData(req)
    .then(function (res) {
      // Write response object to console for debugging
      console.log(res);
      // @todo pass payment token to your gateway to process payment
      // @note DO NOT save the payment credentials for future transactions
      paymentToken = res.paymentMethodData.tokenizationData.token;
      
      // Redirect to success page after successful payment
      window.location.href = '/success';
    })
    .catch(console.error);
}
