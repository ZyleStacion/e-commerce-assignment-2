// Create store item object
class Item {
    constructor(id, name, description, price, quantity, img) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.price = price;
        this.quantity = quantity;
        this.img = img;
    }

    printItem() {
        console.log(this.name);
    }
}

// Create product items
const Bronton = new Item(1, 
    "Bronton", 
    "500W Motor, 48V Battery, Range: 50 miles, Top Speed: 28 mph",
    "3000",
    1, 
    "assets/img/bronton.jpg");

const E_BMX = new Item(2, "E-BMX", "500W Motor, 48V Battery, Range: 50 miles, Top Speed: 28 mph", "2000", 1, "assets/img/dummyimg.jpg");
const F_65 = new Item(3, "F-65", "500W Motor, 48V Battery, Range: 50 miles, Top Speed: 28 mph", "700", 1, "assets/img/f65.jpg");

const shoppingCart = [];

// Add items to cart
function addtoCart(item) {
    let found = false;
    // Check if item already exists in the cart
    for (let i = 0; i < shoppingCart.length; i++) {
        if (shoppingCart[i].name === item.name) {
            shoppingCart[i].quantity++;
            found = true;
            break;
        }
    }
    if (!found) {
        shoppingCart.push(item);
    }
    // Should render an successful message
    let message = `${item.name} has been added to your cart. Click the cart icon to view your cart.`;
    alert(message);
    updateCartPreview();
    return shoppingCart;
}

function getCart() {
    return shoppingCart
}

// Render items into our shopping cart
function updateCartPreview() {
    const cart = getCart();
    const cartPreview = document.getElementById('cart-preview');

    // If the cart is empty, show a message
    if (cart.length === 0) {
        cartPreview.innerHTML = '<li>Your cart is empty</li>';
    } else {
        // Clear existing items
        cartPreview.innerHTML = '';
        cart.forEach(item => {
            const li = document.createElement("li");
            li.textContent = `${item.name} x${item.quantity} = $${item.price * item.quantity}`;
        cartPreview.appendChild(li);
        });
    }
}

// Toggle cart preview visibility
const cartIcon = document.getElementById('shopping-icon');
const cartPreview = document.getElementById('hoverable-cart');

cartIcon.addEventListener('mouseover', () => {
    cartPreview.classList.remove('hidden');
    cartPreview.classList.add('visible');
    updateCartPreview();
});

cartPreview.addEventListener('mouseout', () => {
    cartPreview.classList.remove('visible');
    cartPreview.classList.add('hidden');
});

// Send cart data to the server
function sendCartData() {
    const cart = getCart();
    fetch('/api/cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(cart)
    })
    .then(response => {
        if (response.ok) {
            console.log('Cart data sent successfully');
        } else {
            console.error('Error sending cart data');
        }
    })
    .catch(error => {
        console.error('Error sending cart data:', error);
    });

    return false;
}