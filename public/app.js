let allProducts = [];
let currentCategoryIndexes = {};
const productsPerPage = 4;

async function fetchProducts() {
    try {
        const response = await fetch("/api/products");
        const data = await response.json();
        console.log("API Response:", data);
        allProducts = data.products;
        displayProducts(allProducts);
    } catch (error) {
        console.error("Error fetching products:", error);
    }
}

function displayProducts(categories) {
    const container = document.getElementById("product-container");
    container.innerHTML = '';

    if (!categories || categories.length === 0) {
        container.innerHTML = `<div class="Errorload">No products available.</div>`;
        return;
    }

    categories.forEach(category => {
        if (!currentCategoryIndexes[category.category_name]) {
            currentCategoryIndexes[category.category_name] = 0;
        }

        const categorySection = document.createElement("div");
        categorySection.className = "category-section";

        categorySection.innerHTML = `
      <div class="category-header">
                <h2 class="category-title">${category.category_name}</h2>
                <!-- Clicking "Explore More" redirects to the category page -->
                <a href="/category/${category.category_name}" class="explore-more-link">Explore More</a>
            </div>
    <div class="category-products" id="${category.category_name}-products"></div>
    <div class="pagination">
        <button class="prev-btn" onclick="changePage('${category.category_name}', -1)">
            <i class="fas fa-chevron-left"></i>
        </button>
        <button class="next-btn" onclick="changePage('${category.category_name}', 1)">
            <i class="fas fa-chevron-right"></i>
        </button>
    </div>
`;


        container.appendChild(categorySection);

        const productContainer = document.getElementById(`${category.category_name}-products`);
        displayCategoryProducts(productContainer, category.products, category.category_name);
        const hr = document.createElement("hr");
        hr.className = "category-divider";
        container.appendChild(hr);
    });
}

function displayCategoryProducts(productContainer, products, categoryName) {
    const startIndex = currentCategoryIndexes[categoryName];
    const productsToDisplay = products.slice(startIndex, startIndex + productsPerPage);

    productContainer.innerHTML = '';

    productsToDisplay.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        const imageId = `product-image-${product.product_id}`;

        const initialImage = product.images ? product.images[0] : product.image;
        card.innerHTML = `
            <img id="${imageId}" src="${initialImage}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h2 class="product-name">${product.name}</h2><hr />
                <h3 class="product-desc">${product.description}</h3>
                <div class="product-price-container">
                    <p class="product-price">$${product.price.toFixed(2)}</p>
                    <p class="product-discountedPrice">$${product.discounted_price.toFixed(2)}</p>
                </div>
                <p class="product-rating">Rating: ${product.rating} ★</p>
                <p class="product-stock">Stock: ${product.stock} available</p>
                <div class="product-tags-container">Tags:
                    ${product.tags.map(tag => `<div class="product-tag">${tag}</div>`).join("")}
                </div>
                <div class="button-container">
                    <button class="btn buy-now">
                        <i class="fas fa-shopping-cart"></i> Buy Now
                    </button>
                    <button class="btn add-to-cart">
                        <i class="fas fa-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
        `;
        productContainer.appendChild(card);

        if (product.image && product.image.length > 1) {
            rotateProductImages(product);
        }

        const buyNowButton = card.querySelector('.buy-now');
        const addToCartButton = card.querySelector('.add-to-cart');

        buyNowButton.addEventListener('click', () => {
            buyNow(product);
        });

        addToCartButton.addEventListener('click', () => {
            addToCart(product);
        });
    });
}

function changePage(categoryName, direction) {
    const category = allProducts.find(cat => cat.category_name === categoryName);
    const totalProducts = category.products.length;

    const currentIndex = currentCategoryIndexes[categoryName];
    const newIndex = currentIndex + direction * productsPerPage;

    if (newIndex >= 0 && newIndex < totalProducts) {
        currentCategoryIndexes[categoryName] = newIndex;
        const productContainer = document.getElementById(`${categoryName}-products`);
        displayCategoryProducts(productContainer, category.products, categoryName);
    }
}

function buyNow(product) {
    alert(`Buying product: ${product.name}`);
    window.location.href = "/user/checkout";
}

function addToCart(product) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingProduct = cart.find(i => i.id === product.id);
    if (existingProduct) {
        existingProduct.quantity += 1;
    } else {
        existingProduct.quantity = 1;
        cart.push(product);
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    alert(`Added ${product.name} to cart!`);
}

const searchInput = document.querySelector('.search-input');
const dropdown = document.getElementById('dropdown');

fetchProducts();
document.addEventListener("DOMContentLoaded", function () {
    const dropdownToggle = document.getElementById("dropdownMenu");
    const dropdownMenu = document.querySelector(".dropdown-menu");

    dropdownToggle.addEventListener("click", function (event) {
        event.preventDefault();
        dropdownMenu.classList.toggle("show");
        dropdownToggle.classList.toggle("active");
    });
    window.addEventListener("click", function (event) {
        if (
            !dropdownToggle.contains(event.target) &&
            !dropdownMenu.contains(event.target)
        ) {
            dropdownMenu.classList.remove("show");
            dropdownToggle.classList.remove("active");
        }
    });
});

window.addEventListener("scroll", function () {
    const navbar = document.querySelector(".navbar");
    const onlyRight = document.querySelector("#onlyright");

    if (window.scrollY > 0) {
        navbar.classList.add("scrolled");
        onlyRight.classList.add("scrolled");
    } else {
        navbar.classList.remove("scrolled");
        onlyRight.classList.remove("scrolled");
    }
});

function toggleMenu() {
    const navbar = document.querySelector('.navbar');
    const iconList = document.querySelector('.icon-list');

    navbar.classList.toggle('active');

    iconList.classList.toggle('active');
}


function rotateProductImages(product) {
    const imageElement = document.getElementById(`product-image-${product.product_id}`);
    let currentIndex = 0;

    setInterval(() => {
        currentIndex = (currentIndex + 1) % product.image.length;
        imageElement.src = product.image[currentIndex];
    }, 2000);
}

// welcome pop-up
document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById("welcome-popup");
    const closeBtn = document.getElementById("close-popup");
    popup.style.display = "block";

    const timeout = setTimeout(() => {
        popup.classList.add("hide-popup");
        setTimeout(() => {
            popup.style.display = "none";
        }, 600);
    }, 6000);

    closeBtn.addEventListener("click", () => {
        clearTimeout(timeout);
        popup.classList.add("hide-popup");
        setTimeout(() => {
            popup.style.display = "none";
        }, 600);
    });
});