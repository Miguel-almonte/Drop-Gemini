document.addEventListener('DOMContentLoaded', () => {
    // --- Configuración de la API ---
    const API_BASE_URL = 'http://127.0.0.1:5000/api'; // La dirección de tu servidor Flask

    // --- Estado de la aplicación ---
    let products = []; // Aquí se cargarán los productos desde el back-end
    let cart = [];     // El carrito se gestionará en el back-end, pero se mantendrá una copia local para renderizado
    let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'; // Estado de sesión
    let currentLoggedInUser = localStorage.getItem('loggedInUser') || null; // Usuario actualmente logueado

    // --- Referencias a elementos del DOM ---
    const productsGrid = document.getElementById('products');
    const cartCountSpan = document.getElementById('cart-count');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartIcon = document.getElementById('cart-icon');
    const closeCartBtn = document.getElementById('close-cart');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalPriceSpan = document.getElementById('cart-total-price');
    const emptyCartMessage = document.querySelector('.empty-cart-message');
    const userIcon = document.getElementById('user-icon');
    const loginOverlay = document.getElementById('login-overlay');
    const closeLoginBtn = document.getElementById('close-login');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-button');
    const loginButtonInModal = document.querySelector('.btn-login');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const checkoutButton = document.getElementById('btn-checkout');

    // --- Funciones de Utilidad ---

    /**
     * Muestra una notificación temporal en la pantalla.
     * @param {string} message - El mensaje a mostrar.
     * @param {string} type - 'success' o 'error' para estilos.
     */
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.classList.add('notification', type);
        notification.textContent = message;
        document.body.appendChild(notification);

        // Forzar reflow para la animación CSS
        void notification.offsetWidth;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
            // Eliminar después de que la transición de salida termine
            notification.addEventListener('transitionend', () => notification.remove());
        }, 3000);
    }

    // --- Funciones de Carga de Datos desde el Back-end ---

    /**
     * Carga los productos desde la API de Flask y los renderiza.
     */
    async function fetchProducts() {
        try {
            const response = await fetch(`${API_BASE_URL}/productos`);
            if (!response.ok) {
                throw new Error(`Error HTTP! Estado: ${response.status}`);
            }
            products = await response.json(); // Actualiza la lista global de productos
            renderProducts(products); // Renderiza todos los productos inicialmente
        } catch (error) {
            console.error("Error al cargar productos:", error);
            productsGrid.innerHTML = '<p style="text-align: center; width: 100%; color: var(--price-old-color);">Error al cargar productos. Por favor, asegúrate de que el servidor esté corriendo e inténtalo de nuevo más tarde.</p>';
        }
    }

    /**
     * Carga el carrito del usuario actualmente logueado desde la API.
     * @param {string} username - El nombre de usuario del cual cargar el carrito.
     */
    async function fetchCartItems(username) {
        if (!username) {
            cart = []; // Si no hay usuario, el carrito local está vacío
            renderCartItems(); // Asegura que el carrito se muestre vacío
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/cart/${username}`);
            if (!response.ok) {
                // Si el carrito está vacío en el servidor o el usuario no tiene uno, la API puede devolver 404 o 200 con []
                // Aquí asumimos que 404 significa que el carrito está vacío para ese usuario o no existe.
                if (response.status === 404) {
                     cart = [];
                } else {
                    throw new Error(`Error HTTP! Estado: ${response.status}`);
                }
            } else {
                 cart = await response.json(); // Actualiza el carrito local con lo que viene del servidor
            }
            renderCartItems(); // Renderiza el carrito con los datos obtenidos
        } catch (error) {
            console.error("Error al cargar el carrito:", error);
            cart = []; // Fallback: vaciar el carrito local en caso de error
            renderCartItems();
        }
    }

    // --- Funciones de Renderizado ---

    /**
     * Renderiza la cuadrícula de productos en la página principal.
     * @param {Array} productsToRender - La lista de productos a mostrar.
     */
    function renderProducts(productsToRender) {
        productsGrid.innerHTML = ''; // Limpiar la cuadrícula antes de renderizar

        if (productsToRender.length === 0) {
            productsGrid.innerHTML = '<p style="text-align: center; width: 100%; color: var(--secondary-color);">No se encontraron productos que coincidan con tu búsqueda.</p>';
            return;
        }

        productsToRender.forEach(product => {
            const productCard = document.createElement('div');
            productCard.classList.add('product-card');
            productCard.innerHTML = `
                <img src="${product.image}" alt="${product.name}">
                ${product.discount ? `<span class="discount-percentage">-${product.discount}%</span>` : ''}
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <div class="price ${product.oldPrice ? 'discounted' : ''}">
                        ${product.oldPrice ? `<span class="old-price">$${product.oldPrice.toFixed(2)}</span>` : ''}
                        <span class="current-price">$${product.currentPrice.toFixed(2)}</span>
                    </div>
                    <div class="product-actions">
                        <button class="btn-primary add-to-cart-btn" data-id="${product.id}">Añadir al Carrito</button>
                        <button class="btn-secondary buy-now-btn" data-id="${product.id}">Comprar Ahora</button>
                    </div>
                </div>
            `;
            productsGrid.appendChild(productCard);
        });

        // Añadir listeners a los botones de productos después de que estén en el DOM
        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = parseInt(e.target.dataset.id);
                addToCart(productId);
            });
        });

        document.querySelectorAll('.buy-now-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = parseInt(e.target.dataset.id);
                addToCart(productId);
                cartOverlay.classList.add('active'); // Abre el carrito directamente
            });
        });
    }

    /**
     * Actualiza el contador de ítems en el icono del carrito.
     */
    function updateCartCount() {
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        cartCountSpan.textContent = totalItems;
    }

    /**
     * Renderiza los ítems en el panel lateral del carrito.
     */
    function renderCartItems() {
        cartItemsContainer.innerHTML = ''; // Limpiar el contenedor antes de renderizar
        let totalPrice = 0;

        if (cart.length === 0) {
            emptyCartMessage.style.display = 'block';
        } else {
            emptyCartMessage.style.display = 'none';
            cart.forEach(item => {
                const cartItemDiv = document.createElement('div');
                cartItemDiv.classList.add('cart-item');
                cartItemDiv.innerHTML = `
                    <img src="${item.image}" alt="${item.name}">
                    <div class="item-details">
                        <h4>${item.name}</h4>
                        <p class="item-price-individual">$${item.currentPrice.toFixed(2)}</p>
                        <div class="item-quantity-controls">
                            <button class="decrease-quantity" data-id="${item.id}">-</button>
                            <span>${item.quantity}</span>
                            <button class="increase-quantity" data-id="${item.id}">+</button>
                        </div>
                    </div>
                    <span class="item-price">$${(item.currentPrice * item.quantity).toFixed(2)}</span>
                    <button class="remove-item" data-id="${item.id}">&times;</button>
                `;
                cartItemsContainer.appendChild(cartItemDiv);
                totalPrice += item.currentPrice * item.quantity;
            });
        }
        cartTotalPriceSpan.textContent = totalPrice.toFixed(2);
        updateCartCount(); // Asegura que el contador siempre esté actualizado
    }

    /**
     * Actualiza la interfaz de usuario del modal de login/logout.
     */
    function updateLoginUI() {
        if (isLoggedIn) {
            loginButtonInModal.style.display = 'none';
            logoutButton.style.display = 'block';
            // Opcional: Limpiar campos después de login si no se hace en la función loginUser
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        } else {
            loginButtonInModal.style.display = 'block';
            logoutButton.style.display = 'none';
        }
    }

    // --- Funciones de Lógica de Negocio (Interactuando con el Back-end) ---

    /**
     * Añade un producto al carrito del usuario actual en el back-end.
     * @param {number} productId - El ID del producto a añadir.
     */
    async function addToCart(productId) {
        if (!currentLoggedInUser) {
            showNotification("Por favor, inicia sesión para añadir productos al carrito.", 'error');
            loginOverlay.classList.add('active'); // Abre el modal de login
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/cart/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentLoggedInUser, productId: productId, quantity: 1 })
            });

            const data = await response.json();
            if (response.ok) {
                cart = data.cart; // Actualiza el carrito local con la respuesta del servidor
                renderCartItems();
                // Encuentra el nombre del producto para la notificación
                const addedProduct = products.find(p => p.id === productId);
                showNotification(`${addedProduct ? addedProduct.name : 'Producto'} añadido al carrito.`);
            } else {
                showNotification(`Error: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error("Error al añadir al carrito:", error);
            showNotification("Error de conexión al añadir al carrito.", 'error');
        }
    }

    /**
     * Actualiza la cantidad de un producto en el carrito del back-end (o lo elimina si la cantidad es 0).
     * @param {number} productId - El ID del producto a actualizar.
     * @param {number} change - El cambio de cantidad (ej. 1 para incrementar, -1 para decrementar).
     */
    async function updateCartItemQuantity(productId, change) {
        if (!currentLoggedInUser) {
            showNotification("Necesitas iniciar sesión para modificar el carrito.", 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/cart/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentLoggedInUser, productId: productId, change: change })
            });

            const data = await response.json();
            if (response.ok) {
                cart = data.cart; // Actualiza el carrito local
                renderCartItems();
                showNotification(data.message);
            } else {
                showNotification(`Error: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error("Error al actualizar carrito:", error);
            showNotification("Error de conexión al actualizar carrito.", 'error');
        }
    }

    /**
     * Intenta iniciar sesión con el back-end.
     * @param {string} username - Nombre de usuario.
     * @param {string} password - Contraseña.
     */
    async function loginUser(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                showNotification(data.message);
                isLoggedIn = true;
                currentLoggedInUser = username; // Guarda el usuario logueado
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('loggedInUser', username);
                loginOverlay.classList.remove('active');
                updateLoginUI();
                await fetchCartItems(username); // Cargar el carrito del usuario desde el back-end
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            console.error("Error en el inicio de sesión:", error);
            showNotification("Error de conexión. Asegúrate de que el servidor esté corriendo.", 'error');
        }
    }

    /**
     * Intenta cerrar sesión con el back-end.
     */
    async function logoutUser() {
        if (!currentLoggedInUser) return; // No hay nadie logueado para cerrar sesión

        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            try {
                const response = await fetch(`${API_BASE_URL}/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username: currentLoggedInUser })
                });

                const data = await response.json();

                if (response.ok) {
                    showNotification(data.message);
                    isLoggedIn = false;
                    currentLoggedInUser = null;
                    localStorage.setItem('isLoggedIn', 'false');
                    localStorage.removeItem('loggedInUser'); // Eliminar usuario logueado
                    loginOverlay.classList.remove('active');
                    updateLoginUI();
                    cart = []; // Vaciar el carrito localmente al cerrar sesión
                    renderCartItems(); // Refrescar el carrito en la UI
                } else {
                    showNotification(data.message, 'error');
                }
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                showNotification("Error de conexión. Inténtalo de nuevo.", 'error');
            }
        }
    }

    /**
     * Realiza una búsqueda de productos basada en el término de búsqueda.
     */
    function performSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const filteredProducts = products.filter(product =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm)
        );
        renderProducts(filteredProducts);
    }

    // --- Event Listeners ---

    // Abrir/Cerrar Carrito
    cartIcon.addEventListener('click', (e) => {
        e.preventDefault();
        cartOverlay.classList.add('active');
        // El carrito ya debería estar actualizado si las operaciones de add/update/remove fueron exitosas,
        // pero podemos hacer un fetch aquí para asegurar la sincronización al abrir.
        fetchCartItems(currentLoggedInUser);
    });

    closeCartBtn.addEventListener('click', () => {
        cartOverlay.classList.remove('active');
    });

    cartOverlay.addEventListener('click', (e) => {
        // Cerrar si se hace clic en el fondo oscuro del overlay
        if (e.target === cartOverlay) {
            cartOverlay.classList.remove('active');
        }
    });

    // Añadir/Quitar Cantidad del Carrito (Delegación de eventos)
    cartItemsContainer.addEventListener('click', (e) => {
        const target = e.target;
        const productId = parseInt(target.dataset.id);

        if (target.classList.contains('remove-item')) {
            // Encuentra el ítem en el carrito para obtener su cantidad actual
            const itemToRemove = cart.find(item => item.id === productId);
            if (itemToRemove) {
                updateCartItemQuantity(productId, -itemToRemove.quantity); // Elimina el item completamente
            }
        } else if (target.classList.contains('increase-quantity')) {
            updateCartItemQuantity(productId, 1);
        } else if (target.classList.contains('decrease-quantity')) {
            updateCartItemQuantity(productId, -1);
        }
    });

    // Abrir/Cerrar Login
    userIcon.addEventListener('click', (e) => {
        e.preventDefault();
        loginOverlay.classList.add('active');
        updateLoginUI(); // Actualiza el UI del modal de login al abrir
    });

    closeLoginBtn.addEventListener('click', () => {
        loginOverlay.classList.remove('active');
    });

    loginOverlay.addEventListener('click', (e) => {
        // Cerrar si se hace clic en el fondo oscuro del overlay
        if (e.target === loginOverlay) {
            loginOverlay.classList.remove('active');
        }
    });

    // Manejo del formulario de Login
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        loginUser(username, password);
    });

    // Manejo del botón de Cerrar Sesión
    logoutButton.addEventListener('click', logoutUser);

    // Búsqueda de productos
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Botón "Proceder al Pago Seguro"
    checkoutButton.addEventListener('click', async () => {
        if (!currentLoggedInUser) {
            showNotification("Por favor, inicia sesión para proceder al pago.", 'error');
            loginOverlay.classList.add('active');
            return;
        }
        if (cart.length === 0) {
            showNotification('Tu carrito está vacío. Añade productos para proceder al pago.', 'error');
            return;
        }

        if (confirm('¿Estás seguro de que quieres proceder al pago? (Simulación)')) {
            try {
                const response = await fetch(`${API_BASE_URL}/checkout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentLoggedInUser })
                });

                const data = await response.json();
                if (response.ok) {
                    showNotification(data.message);
                    cart = data.cart; // El carrito debería venir vacío del servidor
                    renderCartItems(); // Actualiza el carrito en la UI
                    cartOverlay.classList.remove('active'); // Cierra el carrito
                } else {
                    showNotification(`Error en el pago: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error("Error durante el proceso de pago:", error);
                showNotification("Hubo un error de conexión al procesar el pago. Por favor, inténtalo de nuevo.", 'error');
            }
        }
    });

    // --- Inicialización al cargar la página ---
    updateLoginUI(); // Ajusta la interfaz de usuario de login al inicio
    fetchProducts(); // Carga los productos al iniciar
    // Si el usuario ya estaba logueado de una sesión anterior, carga su carrito
    if (currentLoggedInUser) {
        fetchCartItems(currentLoggedInUser);
    } else {
        renderCartItems(); // Si no hay usuario, asegura que el carrito se muestre vacío
    }
});

// Estilos para la notificación (puedes mover esto a style.css si prefieres)
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: var(--accent-color);
        color: var(--white-color);
        padding: 10px 20px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 3000;
        opacity: 0;
        transform: translateY(-20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .notification.show {
        opacity: 1;
        transform: translateY(0);
    }
    .notification.error {
        background-color: var(--price-old-color);
    }
`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = notificationStyles;
document.head.appendChild(styleSheet);