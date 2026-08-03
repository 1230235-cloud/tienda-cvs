# Sistema de Inventario para Tienda

Sistema completo de inventario para tienda con 5 módulos principales y dashboard, desarrollado con Node.js, Express, SQLite y Electron para generar un ejecutable portable.

## 📋 Características

- **Dashboard**: Estadísticas generales, alertas de stock, productos más vendidos, PDF de ventas del mes
- **Inventario**: CRUD completo de productos con control de stock
- **Ventas**: Punto de venta con carrito, múltiples métodos de pago e impresión de ticket para impresora térmica
- **Entradas**: Registro de entrada de mercancía con actualización de stock
- **Corte de Caja**: Control de apertura y cierre de caja con reporte de diferencias
- **Códigos de Barras**: Generación e impresión de códigos de barras por categoría

## 🚀 Instalación y Uso

### Requisitos Previos
- Node.js (v18 o superior)
- npm

### Pasos de Instalación

1. **Clonar o descargar el proyecto**
2. **Instalar dependencias**:
```bash
npm install
```

3. **Ejecutar en modo desarrollo**:
```bash
npm start
```

La aplicación se abrirá automáticamente en `http://localhost:3000`

### Acceso al Sistema

**Credenciales por defecto:**
- Usuario: `admin`
- Contraseña: `admin123`

También puedes crear nuevos usuarios desde el login usando el botón **"Crear nuevo usuario"**.

### Uso del Sistema

1. **Primeros pasos**:
   - Abre el navegador en `http://localhost:3000`
   - Comienza agregando productos en el módulo de Inventario
   - Abre un corte de caja antes de iniciar ventas
   - Realiza ventas desde el módulo de Ventas
   - Agrega stock cuando sea necesario desde el módulo de Entradas
   - Cierra el corte de caja al finalizar el turno

2. **Flujo de trabajo recomendado**:
   - Iniciar corte de caja (especificando efectivo inicial)
   - Realizar ventas durante el día
   - Agregar mercancía cuando llegue proveedor
   - Cerrar corte de caja al final del turno
   - Revisar dashboard para estadísticas

## 📦 Generar Ejecutable (.exe) - Electron

El proyecto está configurado para empaquetarse como aplicación de escritorio Windows usando Electron.

### Requisitos para compilar
- Node.js v18 o superior
- Windows 10/11

### Comandos de compilación

```bash
# Instalar dependencias (incluyendo Electron)
npm install

# Compilar el instalador Windows (.exe)
npm run dist
```

### Características del ejecutable

- **Modo Híbrido**: Al abrir el .exe, el usuario puede elegir:
  - **Servidor Base**: Inicia el servidor Node.js/Express y SQLite local. Muestra la IP local para que otros dispositivos se conecten.
  - **Cliente**: Se conecta a un Servidor Base remoto ingresando su IP.
- **Base de datos en AppData**: En el .exe, la base de datos se guarda en `%APPDATA%\SistemaInventario\tienda.db` para evitar errores de permisos.
- **Actualizaciones automáticas**: El .exe consulta automáticamente GitHub en busca de nuevas versiones y permite actualizar con un clic.
- **Accesos directos**: El instalador NSIS crea accesos directos en el Escritorio y Menú Inicio automáticamente.

### Modo Desarrollo (Node.js)

```bash
npm start
```

Abre `http://localhost:3000` en el navegador. En este modo la base de datos se guarda en `data/tienda.db` e incluye datos de prueba.

### Infraestructura para App Móvil (Futuro)

El servidor Express ya tiene configurado `cors` para permitir peticiones desde otros orígenes. En el futuro, una app móvil (APK) en la misma red Wi-Fi podrá conectarse a `http://[IP_SERVIDOR]:3000` consumiendo la misma API REST.

## 🗄️ Base de Datos

El sistema utiliza SQLite como base de datos, la cual se crea automáticamente en la carpeta `data/` la primera vez que se ejecuta la aplicación.

**En modo desarrollo:** la base de datos incluye productos de ejemplo y usuarios de prueba.

**En el ejecutable (.exe):** la base de datos se crea limpia, sin información de prueba ni usuarios precargados. El primer usuario debe crearse desde el login.

## 🖨️ Impresión de Tickets

El sistema genera tickets de venta optimizados para impresoras térmicas. Al completar una venta, se muestra el ticket en pantalla con opción de **Imprimir en Impresora de Tickets**. El diseño del ticket está adaptado para formato de 80mm.

## 📊 Códigos de Barras

El módulo de **Códigos de Barras** permite:
- Seleccionar una categoría de producto
- Generar códigos de barras CODE-128 automáticamente
- Definir la cantidad de etiquetas por producto
- Imprimir las etiquetas en hoja tamaño carta con grilla de 3 columnas
- Cada categoría tiene un prefijo único (Bebidas: 750, Botanas: 751, etc.)

## 🎯 Módulos

### Dashboard
- Vista general de estadísticas
- Alertas de stock bajo
- Productos más vendidos
- Ventas por método de pago
- PDF de ventas del mes

### Inventario
- Agregar, editar y eliminar productos
- Control de stock y stock mínimo
- Búsqueda de productos
- Alertas visuales para stock bajo

### Ventas
- Punto de venta con carrito interactivo
- Búsqueda de productos por código o nombre
- Métodos de pago: Efectivo, Tarjeta, Transferencia, A cargo
- Impresión de ticket
- Historial de ventas recientes

### Entradas
- Registro de entrada de mercancía
- Actualización automática de stock
- Control de proveedores
- Historial de entradas

### Corte de Caja
- Apertura y cierre de turno
- Control de efectivo inicial y final
- Reporte de ventas por método de pago
- Cálculo de diferencias
- Historial de cortes

## 📁 Estructura del Proyecto

```
tienda-cvs/
├── main.js              # Punto de entrada de Electron
├── server.js            # Servidor Express
├── database.js          # Configuración SQLite
├── package.json         # Dependencias y configuración
├── routes/              # Rutas de la API
│   ├── inventario.js
│   ├── ventas.js
│   ├── entradas.js
│   ├── cortes.js
│   ├── dashboard.js
│   └── auth.js
├── public/              # Frontend
│   ├── index.html
│   ├── dashboard.html
│   ├── inventario.html
│   ├── ventas.html
│   ├── entradas.html
│   ├── cortes.html
│   ├── codigos-barras.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── main.js
│       ├── dashboard.js
│       ├── inventario.js
│       ├── ventas.js
│       ├── entradas.js
│       ├── cortes.js
│       └── codigos-barras.js
└── data/                # Base de datos SQLite (se crea automáticamente)
    └── tienda.db
```

## 🔧 Configuración

El sistema está configurado para funcionar en:
- Puerto: 3000
- Base de datos: SQLite en `data/tienda.db`

## 📝 Notas

- La base de datos se crea automáticamente al iniciar la aplicación
- Los datos persisten entre sesiones
- El sistema es completamente portable (no requiere instalación de servidor de base de datos)
- Para producción, comentar la línea `mainWindow.webContents.openDevTools()` en `main.js`
- El sidebar es colapsable por defecto y se expande al pasar el cursor
- Las notificaciones del sistema son personalizadas y no usan alertas nativas del navegador

## 🤝 Soporte

Para cualquier problema o sugerencia, contacte al desarrollador.
