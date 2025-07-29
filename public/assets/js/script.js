// Create store item object
class Item {
    constructor(id, name, price, quantity, img) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.quantity = quantity;
        this.img = img;
    }

    printItem() {
        console.log(this.name);
    }
}

// Create product items
const Bronton = new Item(1, "Bronton", "3000", 1, "public/assets/img/bronton.jpg");
const E_BMX = new Item(2, "E-BMX", "2000", 1, "public/assets/img/dummyimg.jpg");
const F_65 = new Item(3, "F-65", "700", 1, "public/assets/img/f65.jpg");

const shoppingCart = [];

// Add items to cart
function addtoCart(item) {
    if (shoppingCart.length > 0) {
        for (let i = 0; i < shoppingCart.length; i++) {
            if (shoppingCart[i].name == item.name) {
                shoppingCart[i].quantity ++;
            }
            else {
                shoppingCart.push(item);
            }
        }
    }
    else {
        shoppingCart.push(item);
    }
    console.log(shoppingCart);
    return shoppingCart;
}