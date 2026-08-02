# Sistema de Inventario para Tienda

Sistema completo de inventario para tienda con 4 módulos principales y dashboard, desarrollado con Node.js, Express, SQLite y Electron para generar un ejecutable portable.

## 📋 Características

- **Dashboard**: Estadísticas generales, alertas de stock, productos más vendidos
- **Inventario**: CRUD completo de productos con control de stock
- **Ventas**: Punto de venta con carrito, múltiples métodos de pago e impresión de ticket
- **Entradas**: Registro de entrada de mercancía con actualización de stock
- **Corte de Caja**: Control de apertura y cierre de caja con reporte de diferencias

## 🚀 Instalación y Uso

### Requisitos Previos
- Node.js (v16 o superior)
- npm

### Pasos de Instalación

1. **Instalar dependencias**:
```bash
npm install
```

2. **Ejecutar en modo desarrollo**:
```bash
npm start
```

La aplicación se abrirá automáticamente en `http://localhost:3000`

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

## 📦 Generar Ejecutable (.exe)

Para generar el instalador de Windows:

```bash
npm run build-win
```

El instalador se generará en la carpeta `dist/`

## 🗄️ Base de Datos

El sistema utiliza SQLite como base de datos, la cual se crea automáticamente en la carpeta `data/` la primera vez que se ejecuta la aplicación.

## 🎯 Módulos

### Dashboard
- Vista general de estadísticas
- Alertas de stock bajo
- Productos más vendidos
- Ventas por método de pago

### Inventario
- Agregar, editar y eliminar productos
- Control de stock y stock mínimo
- Búsqueda de productos
- Alertas visuales para stock bajo

### Ventas
- Punto de venta con carrito interactivo
- Búsqueda de productos por código o nombre
- Métodos de pago: Efectivo, Tarjeta, Transferencia
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

## 🖨️ Impresión de Tickets

El sistema genera tickets de venta en formato para impresora térmica. Al completar una venta, se muestra el ticket en pantalla con opción de imprimir.

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
│   └── dashboard.js
├── public/              # Frontend
│   ├── index.html
│   ├── dashboard.html
│   ├── inventario.html
│   ├── ventas.html
│   ├── entradas.html
│   ├── cortes.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── main.js
│       ├── dashboard.js
│       ├── inventario.js
│       ├── ventas.js
│       ├── entradas.js
│       └── cortes.js
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

## 🤝 Soporte

Para cualquier problema o sugerencia, contacte al desarrollador.
