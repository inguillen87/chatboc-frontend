// Mock Catalogs for Demo Tenants
// Professional, high-quality data for various industries

const IMAGES = {
  bodega: {
    malbec: "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&q=80&w=400",
    cabernet: "https://images.unsplash.com/photo-1559563362-c667ba5f5480?auto=format&fit=crop&q=80&w=400",
    chardonnay: "https://images.unsplash.com/photo-1572569666069-42512f718816?auto=format&fit=crop&q=80&w=400"
  },
  ferreteria: {
    taladro: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=400",
    destornilladores: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&q=80&w=400",
    lijadora: "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?auto=format&fit=crop&q=80&w=400"
  },
  almacen: {
    yerba: "https://images.unsplash.com/photo-1565258700208-c8a514d02633?auto=format&fit=crop&q=80&w=400",
    aceite: "https://images.unsplash.com/photo-1474979266404-7caddbed77a8?auto=format&fit=crop&q=80&w=400",
    cafe: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=400"
  },
  farmacia: {
    vitaminas: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400",
    crema: "https://images.unsplash.com/photo-1615397349754-cfa2066a298e?auto=format&fit=crop&q=80&w=400",
    termometro: "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&q=80&w=400"
  },
  restaurante: {
    hamburguesa: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400",
    pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400",
    ensalada: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400"
  },
  ropa: {
    camisa: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=400",
    jeans: "https://images.unsplash.com/photo-1542272617-08f086303294?auto=format&fit=crop&q=80&w=400",
    zapatillas: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400"
  },
  logistica: {
    envio_express: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=400",
    almacenaje: "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&q=80&w=400",
    tracking: "https://images.unsplash.com/photo-1566576912902-1dcd47eb7952?auto=format&fit=crop&q=80&w=400"
  },
  seguros: {
    auto: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&q=80&w=400",
    hogar: "https://images.unsplash.com/photo-1560518883-ce09059ee971?auto=format&fit=crop&q=80&w=400",
    vida: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=400"
  },
  inmobiliaria: {
    depto: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=400",
    casa: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&q=80&w=400",
    oficina: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=400"
  },
  clinica: {
    consulta: "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&q=80&w=400",
    analisis: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=400",
    telemedicina: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=400"
  }
};

export const BODEGA_PRODUCTS = [
  { id: "wine-1", name: "Malbec Reserva 2020", description: "Vino tinto de gran cuerpo, notas a frutos rojos. Crianza 12 meses.", price: 4500, image: IMAGES.bodega.malbec, category: "Vinos Tintos", stock: 50 },
  { id: "wine-2", name: "Cabernet Sauvignon", description: "Equilibrado y elegante, ideal para carnes.", price: 4200, image: IMAGES.bodega.cabernet, category: "Vinos Tintos", stock: 45 },
  { id: "wine-3", name: "Chardonnay Orgánico", description: "Blanco fresco y frutado, certificado orgánico.", price: 3800, image: IMAGES.bodega.chardonnay, category: "Vinos Blancos", stock: 30 }
];

export const FERRETERIA_PRODUCTS = [
  { id: "tool-1", name: "Taladro Percutor 600W", description: "Ideal para trabajos hogareños. Incluye maletín.", price: 45000, image: IMAGES.ferreteria.taladro, category: "Herramientas Eléctricas", stock: 10 },
  { id: "tool-2", name: "Set Destornilladores", description: "Juego de 6 piezas punta magnética.", price: 8500, image: IMAGES.ferreteria.destornilladores, category: "Herramientas Manuales", stock: 25 },
  { id: "tool-3", name: "Lijadora Orbital", description: "Potente motor de 200W, diseño ergonómico.", price: 32000, image: IMAGES.ferreteria.lijadora, category: "Herramientas Eléctricas", stock: 5 }
];

export const ALMACEN_PRODUCTS = [
  { id: "food-1", name: "Yerba Mate Premium 1kg", description: "Estacionamiento natural por 24 meses.", price: 3500, image: IMAGES.almacen.yerba, category: "Almacén", stock: 100 },
  { id: "food-2", name: "Aceite de Oliva Extra", description: "Primera prensada en frío, acidez < 0.5%.", price: 8900, image: IMAGES.almacen.aceite, category: "Aceites", stock: 40 },
  { id: "food-3", name: "Café en Grano Tostado", description: "Blend de la casa, 100% arábica.", price: 6500, image: IMAGES.almacen.cafe, category: "Cafetería", stock: 30 }
];

export const FARMACIA_PRODUCTS = [
  { id: "farma-1", name: "Multivitamínico Plus", description: "Energía y defensas. 30 comprimidos.", price: 5200, image: IMAGES.farmacia.vitaminas, category: "Suplementos", stock: 20 },
  { id: "farma-2", name: "Crema Hidratante Facial", description: "Dermatológicamente testeada. 50g.", price: 8500, image: IMAGES.farmacia.crema, category: "Dermocosmética", stock: 15 },
  { id: "farma-3", name: "Termómetro Digital", description: "Medición rápida y precisa con alarma.", price: 3500, image: IMAGES.farmacia.termometro, category: "Accesorios", stock: 50 }
];

export const RESTAURANTE_PRODUCTS = [
  { id: "resto-1", name: "Hamburguesa Gourmet", description: "Doble carne, cheddar, panceta y cebolla caramelizada.", price: 6500, image: IMAGES.restaurante.hamburguesa, category: "Hamburguesas", stock: 100 },
  { id: "resto-2", name: "Pizza Napolitana", description: "Muzzarella, tomate natural, ajo y albahaca.", price: 5800, image: IMAGES.restaurante.pizza, category: "Pizzas", stock: 50 },
  { id: "resto-3", name: "Ensalada César", description: "Lechuga, croutons, parmesano y aderezo especial.", price: 4200, image: IMAGES.restaurante.ensalada, category: "Ensaladas", stock: 30 }
];

export const ROPA_PRODUCTS = [
  { id: "ropa-1", name: "Camisa Oxford Blanca", description: "Algodón 100%, corte regular fit.", price: 28000, image: IMAGES.ropa.camisa, category: "Camisas", stock: 20 },
  { id: "ropa-2", name: "Jean Clásico Azul", description: "Denim de alta calidad, tiro medio.", price: 35000, image: IMAGES.ropa.jeans, category: "Pantalones", stock: 25 },
  { id: "ropa-3", name: "Zapatillas Urbanas", description: "Comodidad para el día a día. Cuero ecológico.", price: 45000, image: IMAGES.ropa.zapatillas, category: "Calzado", stock: 15 }
];

export const LOGISTICA_PRODUCTS = [
  { id: "log-1", name: "Envío Express AMBA", description: "Entrega en el día para paquetes hasta 5kg.", price: 4500, image: IMAGES.logistica.envio_express, category: "Envíos", stock: 999 },
  { id: "log-2", name: "Almacenaje por m3", description: "Depósito seguro mensual por metro cúbico.", price: 15000, image: IMAGES.logistica.almacenaje, category: "Depósito", stock: 50 },
  { id: "log-3", name: "Servicio de Tracking", description: "Seguimiento satelital en tiempo real.", price: 2500, image: IMAGES.logistica.tracking, category: "Tecnología", stock: 999 }
];

export const SEGUROS_PRODUCTS = [
  { id: "seg-1", name: "Seguro Automotor Full", description: "Cobertura todo riesgo con franquicia.", price: 25000, image: IMAGES.seguros.auto, category: "Automotor", stock: 999 },
  { id: "seg-2", name: "Seguro de Hogar", description: "Protección contra incendio, robo y daños.", price: 8500, image: IMAGES.seguros.hogar, category: "Hogar", stock: 999 },
  { id: "seg-3", name: "Seguro de Vida", description: "Tranquilidad para tu familia. Capital asegurado flexible.", price: 5000, image: IMAGES.seguros.vida, category: "Personas", stock: 999 }
];

export const INMOBILIARIA_PRODUCTS = [
  { id: "inmo-1", name: "Departamento 2 Ambientes", description: "Alquiler temporal. Palermo Hollywood.", price: 450000, image: IMAGES.inmobiliaria.depto, category: "Alquileres", stock: 1 },
  { id: "inmo-2", name: "Casa en Barrio Cerrado", description: "Venta. 4 dormitorios, piscina y jardín.", price: 250000, image: IMAGES.inmobiliaria.casa, category: "Ventas", stock: 1, currency: "USD" },
  { id: "inmo-3", name: "Oficina Corporativa", description: "Alquiler. Centro empresarial, 150m2.", price: 850000, image: IMAGES.inmobiliaria.oficina, category: "Comercial", stock: 2 }
];

export const CLINICA_PRODUCTS = [
  { id: "clin-1", name: "Consulta Médica", description: "Atención primaria con especialistas.", price: 8000, image: IMAGES.clinica.consulta, category: "Consultas", stock: 999 },
  { id: "clin-2", name: "Chequeo General", description: "Laboratorio completo + ECG + Consulta.", price: 25000, image: IMAGES.clinica.analisis, category: "Estudios", stock: 999 },
  { id: "clin-3", name: "Videoconsulta", description: "Atención médica remota inmediata.", price: 6000, image: IMAGES.clinica.telemedicina, category: "Telemedicina", stock: 999 }
];

export const DEMO_CATALOGS: Record<string, any[]> = {
  bodega: BODEGA_PRODUCTS,
  ferreteria: FERRETERIA_PRODUCTS,
  almacen: ALMACEN_PRODUCTS,
  kiosco: ALMACEN_PRODUCTS,
  farmacia: FARMACIA_PRODUCTS,
  restaurante: RESTAURANTE_PRODUCTS,
  gastronomia: RESTAURANTE_PRODUCTS,
  ropa: ROPA_PRODUCTS,
  tienda: ROPA_PRODUCTS,
  logistica: LOGISTICA_PRODUCTS,
  transporte: LOGISTICA_PRODUCTS,
  seguros: SEGUROS_PRODUCTS,
  inmobiliaria: INMOBILIARIA_PRODUCTS,
  clinica: CLINICA_PRODUCTS,
  medico: CLINICA_PRODUCTS,
  salud: CLINICA_PRODUCTS,
  // Fallbacks for similar categories
  fintech: SEGUROS_PRODUCTS, // Placeholder
  industria: LOGISTICA_PRODUCTS // Placeholder
};
