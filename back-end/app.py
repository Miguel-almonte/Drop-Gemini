from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Habilitar CORS para permitir solicitudes desde tu front-end

# --- Base de Datos Simulada (para empezar) ---
# En un entorno real, esto sería una base de datos como PostgreSQL o MySQL
# y tendríamos modelos para Productos, Usuarios, Carritos, Pedidos, etc.

productos_db = [
    {"id": 1, "nombre": "Auriculares Inalámbricos Pro", "imagen": "https://via.placeholder.com/300x250/FF5733/FFFFFF?text=Auriculares", "precio_antiguo": 79.99, "precio_actual": 59.99, "descuento": 25, "descripcion": "Auriculares de alta calidad con sonido envolvente y batería de larga duración. Ideales para música y llamadas."},
    {"id": 2, "nombre": "Smartwatch Deportivo Xtreme", "imagen": "https://via.placeholder.com/300x250/33FF57/FFFFFF?text=Smartwatch", "precio_antiguo": 120.00, "precio_actual": 99.99, "descuento": 17, "descripcion": "Monitoriza tu actividad física, ritmo cardíaco y sueño con estilo. Compatible con iOS y Android."},
    # Puedes añadir más productos aquí, como los que ya tienes en tu JS
]

usuarios_db = {
    "test": {"password": "123", "is_logged_in": False} # Contraseña sin hashear SOLO PARA EJEMPLO
}

carrito_db = {} # Almacena carritos por ID de usuario (simulado)

# --- Rutas de la API ---

@app.route('/api/productos', methods=['GET'])
def get_productos():
    """Devuelve la lista de todos los productos."""
    return jsonify(productos_db)

@app.route('/api/login', methods=['POST'])
def login():
    """Maneja el inicio de sesión de usuarios."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if username in usuarios_db and usuarios_db[username]['password'] == password:
        usuarios_db[username]['is_logged_in'] = True
        return jsonify({"message": "Inicio de sesión exitoso", "username": username, "isLoggedIn": True}), 200
    else:
        return jsonify({"message": "Credenciales inválidas"}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    """Maneja el cierre de sesión."""
    data = request.get_json()
    username = data.get('username')

    if username in usuarios_db:
        usuarios_db[username]['is_logged_in'] = False
        return jsonify({"message": "Sesión cerrada exitosamente", "isLoggedIn": False}), 200
    return jsonify({"message": "Usuario no encontrado"}), 404

@app.route('/api/cart/<username>', methods=['GET'])
def get_cart(username):
    """Obtiene el contenido del carrito de un usuario."""
    cart_items = carrito_db.get(username, [])
    return jsonify(cart_items)

@app.route('/api/cart/add', methods=['POST'])
def add_to_cart():
    """Añade un producto al carrito de un usuario."""
    data = request.get_json()
    username = data.get('username')
    product_id = data.get('productId')
    quantity = data.get('quantity', 1)

    if not username:
        return jsonify({"message": "Se requiere nombre de usuario para el carrito."}), 400

    producto = next((p for p in productos_db if p['id'] == product_id), None)
    if not producto:
        return jsonify({"message": "Producto no encontrado."}), 404

    if username not in carrito_db:
        carrito_db[username] = []

    # Verificar si el producto ya está en el carrito
    existing_item = next((item for item in carrito_db[username] if item['id'] == product_id), None)
    if existing_item:
        existing_item['quantity'] += quantity
    else:
        carrito_db[username].append({"id": product_id, "name": producto['nombre'], "image": producto['imagen'], "currentPrice": producto['precio_actual'], "quantity": quantity})

    return jsonify({"message": "Producto añadido al carrito.", "cart": carrito_db[username]}), 200

@app.route('/api/cart/update', methods=['POST'])
def update_cart():
    """Actualiza la cantidad de un producto en el carrito o lo elimina si la cantidad es 0."""
    data = request.get_json()
    username = data.get('username')
    product_id = data.get('productId')
    change = data.get('change') # Puede ser 1, -1, o cualquier número

    if not username:
        return jsonify({"message": "Se requiere nombre de usuario."}), 400

    if username not in carrito_db:
        return jsonify({"message": "Carrito vacío o usuario no encontrado."}), 404

    item_found = False
    for i, item in enumerate(carrito_db[username]):
        if item['id'] == product_id:
            item['quantity'] += change
            if item['quantity'] <= 0:
                carrito_db[username].pop(i) # Eliminar el item
            item_found = True
            break
    
    if not item_found:
        return jsonify({"message": "Producto no encontrado en el carrito."}), 404

    return jsonify({"message": "Carrito actualizado.", "cart": carrito_db[username]}), 200

@app.route('/api/checkout', methods=['POST'])
def checkout():
    """Simula el proceso de pago."""
    data = request.get_json()
    username = data.get('username')
    
    if not username or username not in carrito_db or not carrito_db[username]:
        return jsonify({"message": "Carrito vacío o usuario no válido."}), 400
    
    # Aquí iría la lógica real de integración con la pasarela de pago (Stripe/PayPal/AZUL)
    # Por ahora, solo simulamos el éxito y vaciamos el carrito.
    
    # Simulación de un pago exitoso
    print(f"Procesando pago para {username} con items: {carrito_db[username]}")
    carrito_db[username] = [] # Vaciar el carrito después del "pago"
    return jsonify({"message": "Pago procesado exitosamente. Tu pedido ha sido enviado.", "cart": []}), 200


# Solo ejecutar el servidor si el script se ejecuta directamente
if __name__ == '__main__':
    app.run(debug=True, port=5000) # El servidor correrá en http://localhost:5000