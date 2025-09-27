const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // Importar multer
const fs = require('fs'); // Importar fs para crear directorio si no existe

const { getAttentionMessage } = require('./widgetAttention');
const { getMunicipalStats, getMunicipalStatsFiltersData } = require('./municipalStats'); // Added getMunicipalStatsFiltersData
const { getFormattedProducts } = require('./catalog');
const { getBusinessMetrics } = require('./businessMetrics');
const { getMunicipalAnalytics } = require('./municipalAnalytics');
const {
  getMunicipalMessageMetrics,
  generateCsvReport,
  generatePdfReport,
} = require('./municipalMessageMetrics');
const { getTicketMessagesById } = require('./db');
const sessionMiddleware = require('./session');
const cartRoutes = require('./cartRoutes');
const preferences = require('./preferences');

const DEFAULT_WEEK_DAYS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const PLAN_DEFINITIONS = {
  gratis: {
    name: 'Inicia con IA',
    price: 0,
    currency: 'ARS',
    messageLimit: 100,
    technologies: [
      'Chatbot IA básico',
      'Widget web personalizable',
      'Carga de hasta 2 documentos (PDF/Excel)',
    ],
  },
  pro: {
    name: 'Plan Pro',
    price: 65000,
    currency: 'ARS',
    messageLimit: 1000,
    technologies: [
      'Chatbot IA avanzado y entrenamiento personalizado',
      'CRM integrado para seguimiento de clientes',
      'Integraciones esenciales (email, formularios, catálogos)',
      'Paneles analíticos con métricas de interacción',
    ],
  },
  full: {
    name: 'Plan Full',
    price: 95000,
    currency: 'ARS',
    messageLimit: Infinity,
    technologies: [
      'Automatización end-to-end de campañas y workflows',
      'Integraciones avanzadas con sistemas externos (ERP, GovTech, BI)',
      'Envío automático de catálogos, promociones y formularios',
      'Soporte dedicado, onboarding y consultoría especializada',
    ],
  },
};

const MERCADO_PAGO_PLAN_MAP = {
  '2c9380849764e81a01976585767f0040': 'pro',
  '2c9380849763daeb0197658791ee00b1': 'full',
};

function ensureUserProfile(session) {
  if (!session.userProfile) {
    session.userProfile = {
      id: 1,
      nombre_empresa: 'Demo Chatboc',
      telefono: '',
      direccion: '',
      ciudad: '',
      provincia: '',
      pais: 'Argentina',
      latitud: null,
      longitud: null,
      link_web: '',
      plan: 'gratis',
      preguntas_usadas: 0,
      limite_preguntas: PLAN_DEFINITIONS.gratis.messageLimit,
      rubro: 'pyme',
      logo_url: '',
      horario_json: DEFAULT_WEEK_DAYS.map((dia, idx) => ({
        dia,
        abre: idx >= 5 ? '' : '09:00',
        cierra: idx >= 5 ? '' : '20:00',
        cerrado: idx >= 5,
      })),
      tecnologias_plan: PLAN_DEFINITIONS.gratis.technologies,
      plan_precio: PLAN_DEFINITIONS.gratis.price,
      plan_moneda: PLAN_DEFINITIONS.gratis.currency,
      plan_actualizado_en: new Date().toISOString(),
    };
  }
  return session.userProfile;
}

function normalizeLimit(limit) {
  return limit === Infinity ? Number.MAX_SAFE_INTEGER : limit;
}

function applyPlanToProfile(profile, planKey) {
  const definition = PLAN_DEFINITIONS[planKey];
  if (!definition) {
    throw new Error('Plan inválido');
  }

  profile.plan = planKey;
  profile.limite_preguntas = normalizeLimit(definition.messageLimit);
  profile.tecnologias_plan = definition.technologies;
  profile.plan_precio = definition.price;
  profile.plan_moneda = definition.currency;
  profile.plan_actualizado_en = new Date().toISOString();
  const usedQuestions = Number(profile.preguntas_usadas) || 0;
  profile.preguntas_usadas = Math.min(usedQuestions, profile.limite_preguntas);
  return profile;
}

function buildPlanPayload(planKey) {
  const definition = PLAN_DEFINITIONS[planKey];
  if (!definition) {
    return null;
  }
  return {
    slug: planKey,
    name: definition.name,
    price: definition.price,
    currency: definition.currency,
    message_limit: definition.messageLimit === Infinity ? null : definition.messageLimit,
    unlimited: definition.messageLimit === Infinity,
    technologies: definition.technologies,
  };
}

function buildProfileResponse(profile) {
  const definition = PLAN_DEFINITIONS[profile.plan] || PLAN_DEFINITIONS.gratis;
  return {
    ...profile,
    limite_preguntas: normalizeLimit(definition.messageLimit),
    plan_precio: definition.price,
    plan_moneda: definition.currency,
    tecnologias_plan: definition.technologies,
  };
}

const app = express();
app.use(express.json());

// CORS Configuration
const whitelist = [
  'https://chatboc.ar',
  'https://chatboc-demo-widget-oigs.vercel.app',
  'http://localhost:5173', // Common dev port for Vite
  'http://localhost:3000'  // Common dev port for backend
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(sessionMiddleware);

app.get('/plans', (req, res) => {
  const plans = Object.keys(PLAN_DEFINITIONS).map((key) => buildPlanPayload(key));
  res.json({ plans });
});

app.get('/me', (req, res) => {
  const profile = buildProfileResponse(ensureUserProfile(req.session));
  res.json(profile);
});

app.get('/perfil', (req, res) => {
  const profile = buildProfileResponse(ensureUserProfile(req.session));
  res.json(profile);
});

app.put('/perfil', (req, res) => {
  const profile = ensureUserProfile(req.session);
  const editableFields = [
    'nombre_empresa',
    'telefono',
    'direccion',
    'ciudad',
    'provincia',
    'pais',
    'latitud',
    'longitud',
    'link_web',
    'logo_url',
  ];

  editableFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      profile[field] = req.body[field];
    }
  });

  if (typeof req.body.horario_json === 'string') {
    try {
      const parsed = JSON.parse(req.body.horario_json);
      if (Array.isArray(parsed)) {
        profile.horario_json = parsed;
      }
    } catch (error) {
      console.warn('No se pudo parsear horario_json', error);
    }
  }

  const response = buildProfileResponse(profile);
  res.json({ mensaje: 'Perfil actualizado correctamente.', perfil: response });
});

app.post('/plan/activate', (req, res) => {
  const { plan, preapproval_plan_id: preapprovalPlanId } = req.body || {};
  let planKey = typeof plan === 'string' ? plan.toLowerCase() : null;
  if (!planKey && typeof preapprovalPlanId === 'string') {
    planKey = MERCADO_PAGO_PLAN_MAP[preapprovalPlanId] || null;
  }

  if (!planKey || !PLAN_DEFINITIONS[planKey]) {
    return res.status(400).json({ error: 'Plan inválido.' });
  }

  const profile = ensureUserProfile(req.session);
  try {
    applyPlanToProfile(profile, planKey);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({
    mensaje: `Plan ${PLAN_DEFINITIONS[planKey].name} activado correctamente.`,
    perfil: buildProfileResponse(profile),
    plan: buildPlanPayload(planKey),
  });
});

const FILES_DIR = path.join(__dirname, 'files');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Asegurarse de que el directorio de subidas exista
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuración de Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Nombre único: timestamp + nombre original para evitar colisiones pero mantener referencia
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniquePrefix + '-' + file.originalname);
  }
});

const ALLOWED_EXTENSIONS_BACKEND = [
  'jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'xls', 'csv', 'docx', 'txt'
];

const fileFilter = (req, file, cb) => {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (ext && ALLOWED_EXTENSIONS_BACKEND.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido por el backend.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB Límite de tamaño, igual que en frontend
});


app.get('/widget/attention', (req, res) => {
  res.json({ message: getAttentionMessage() });
});


app.get('/municipal/stats', (req, res) => {
  try {
    const filters = {
      rubro: req.query.rubro,
      barrio: req.query.barrio,
      tipo: req.query.tipo,
      rango: req.query.rango,
    };
    // Remove undefined filters to avoid passing them as "undefined" string
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const stats = getMunicipalStats(filters);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching municipal stats:', error);
    res.status(500).json({ error: 'Failed to load municipal stats' });
  }
});

app.get('/municipal/stats/filters', (req, res) => {
  try {
    const filters = getMunicipalStatsFiltersData();
    res.json(filters);
  } catch (error) {
    console.error('Error fetching municipal stats filters:', error);
    res.status(500).json({ error: 'Failed to load filters' });
  }
});

app.get('/municipal/analytics', (req, res) => {
  res.json(getMunicipalAnalytics());
});

app.get('/municipal/message-metrics', (req, res) => {
  res.json(getMunicipalMessageMetrics());
});

app.get('/municipal/message-metrics.csv', (req, res) => {
  const csv = generateCsvReport();
  res.type('text/csv').attachment('message-metrics.csv').send(csv);
});

app.get('/municipal/message-metrics.pdf', (req, res) => {
  const pdf = generatePdfReport();
  res.type('application/pdf').attachment('message-metrics.pdf').send(pdf);
});

// Historial de mensajes de un ticket específico
app.get('/tickets/chat/:ticketId/mensajes', (req, res) => {
  const { ticketId } = req.params;
  const mensajes = getTicketMessagesById(ticketId);
  res.json({ mensajes });
});

app.get('/productos', (req, res) => {
  const q = (req.query.q || req.query.search || '').toString().trim();
  if (q) {
    preferences.addPreference(req.session, q);
  }
  res.json(getFormattedProducts());
});

app.get('/files/:name', (req, res) => {
  const filePath = path.join(FILES_DIR, req.params.name);
  res.download(filePath);
});

app.get('/pyme/metrics', (req, res) => {
  res.json(getBusinessMetrics(req.session));
});

app.post('/ask/pyme', (req, res) => {
  const pregunta = (req.body.pregunta || '').toLowerCase();
  if (pregunta.includes('ver catalogo') || pregunta.includes('ver catálogo')) {
    return res.json({ productos: getFormattedProducts() });
  }
  if (
    pregunta.includes('descargar catalogo') ||
    pregunta.includes('descargar catálogo')
  ) {
    return res.json({
      respuesta: 'Descarga directa',
      media_url: '/files/catalog.pdf',
      botones: [
        { texto: 'Descargar catálogo', url: '/files/catalog.pdf' },
      ],
    });
  }
  res.json({ reply: 'Pregunta no reconocida' });
});

app.use('/carrito', cartRoutes);

// Endpoint para subir archivos
app.post('/archivos/subir', upload.single('archivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó ningún archivo o el tipo de archivo no es permitido.' });
  }

  // Construir la URL de descarga. Asumir que el servidor está en localhost:3000 para desarrollo.
  // En producción, esto debería ser la URL pública del servidor.
  const port = process.env.PORT || 3000;
  // NOTA: En un entorno de producción real, req.protocol y req.get('host') podrían ser más robustos
  // o una variable de entorno para el dominio base.
  const fileUrl = `${req.protocol}://${req.hostname}:${port}/uploads/${req.file.filename}`;

  res.json({
    url: fileUrl,
    name: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    // serverFilename: req.file.filename // Opcional: para debugging o si se necesita internamente
  });
}, (error, req, res, next) => {
  // Middleware de manejo de errores específico para multer (ej. error de fileFilter)
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  } else if (error) {
    // Otro error (ej. del fileFilter personalizado)
    return res.status(400).json({ error: error.message });
  }
  // Si no hay error de multer pero req.file no está (ej. filtro falló silenciosamente antes)
  if (!req.file) {
     return res.status(400).json({ error: 'No se pudo procesar el archivo. Verifique el tipo y tamaño.' });
  }
  next();
});

// Endpoint para servir/descargar archivos subidos
app.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(UPLOADS_DIR, filename);

  // Verificar que el archivo exista y que no se intente acceder a rutas superiores (path traversal)
  // path.normalize asegura que no haya '..' o '.' extraños.
  // startsWith(UPLOADS_DIR) asegura que el path resuelto siga dentro del directorio de uploads.
  if (!fs.existsSync(filePath) || !path.normalize(filePath).startsWith(UPLOADS_DIR)) {
    return res.status(404).send('Archivo no encontrado.');
  }

  // res.download() establece Content-Disposition: attachment, lo que sugiere descarga.
  res.download(filePath, (err) => {
    if (err) {
      // Manejar errores, por ejemplo, si el archivo se elimina después de la comprobación de existencia
      // o si hay problemas de permisos.
      console.error("Error al descargar el archivo:", err);
      if (!res.headersSent) { // Solo enviar respuesta si no se ha enviado una ya
        res.status(500).send('No se pudo descargar el archivo.');
      }
    }
  });
});


module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
