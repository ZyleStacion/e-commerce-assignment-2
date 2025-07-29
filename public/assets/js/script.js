// Create store item object
class item {
    constructor(id, name, price, quantity, img) {
        this.id = id;
        this.name = name;
        this.price = price;
        // this.quantity = quantity;
        this.img = img;
    }

    printItem() {
        console.log(this.name);
    }
}

// TODO: Create product items
new item = item(1, "Bronton", "3000", "assets/img/bronton.jpg")


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
        shoppingCart.append(item);
    }
    console.log(shoppingCart);
    return shoppingCart;
}