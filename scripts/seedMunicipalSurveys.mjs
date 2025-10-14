#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const [flag, value] = current.split('=');
    if (typeof value !== 'undefined') {
      args[flag.slice(2)] = value;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[flag.slice(2)] = next;
      index += 1;
    } else {
      args[flag.slice(2)] = true;
    }
  }
  return args;
};

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const templateReplace = (text, municipality) =>
  typeof text === 'string' ? text.replace(/\{\{municipality\}\}/g, municipality) : text;

const buildPayload = (template, municipality) => {
  const now = new Date();
  const finAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    titulo: templateReplace(template.titulo, municipality),
    slug: `${template.slug}-${slugify(municipality)}`.slice(0, 80),
    descripcion: templateReplace(template.descripcion, municipality),
    tipo: template.tipo,
    inicio_at: now.toISOString(),
    fin_at: finAt.toISOString(),
    politica_unicidad: template.politica_unicidad,
    anonimato: Boolean(template.anonimato),
    requiere_datos_contacto: Boolean(template.requiere_datos_contacto),
    preguntas: (template.preguntas ?? []).map((pregunta, preguntaIndex) => ({
      orden: typeof pregunta.orden === 'number' ? pregunta.orden : preguntaIndex + 1,
      tipo: pregunta.tipo,
      texto: templateReplace(pregunta.texto, municipality),
      obligatoria: Boolean(pregunta.obligatoria),
      min_selecciones: typeof pregunta.min_selecciones === 'number' ? pregunta.min_selecciones : undefined,
      max_selecciones: typeof pregunta.max_selecciones === 'number' ? pregunta.max_selecciones : undefined,
      opciones: Array.isArray(pregunta.opciones)
        ? pregunta.opciones.map((opcion, opcionIndex) => ({
            orden: typeof opcion.orden === 'number' ? opcion.orden : opcionIndex + 1,
            texto: templateReplace(opcion.texto, municipality),
            valor: opcion.valor ? templateReplace(opcion.valor, municipality) : undefined,
          }))
        : undefined,
    })),
  };
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const municipalitiesRaw = args.municipalities ?? args.m;
  if (!municipalitiesRaw) {
    console.error('Uso: node scripts/seedMunicipalSurveys.mjs --municipalities "Junín Mendoza, San Martín Mendoza" --token <TOKEN> [--api https://api.example.com] [--publish] [--dry-run]');
    process.exitCode = 1;
    return;
  }

  const municipalities = String(municipalitiesRaw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!municipalities.length) {
    console.error('No se detectaron municipios válidos.');
    process.exitCode = 1;
    return;
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(scriptDir, '../docs/surveys/municipal-templates.json');

  let templates;
  try {
    const raw = await fs.readFile(templatePath, 'utf8');
    templates = JSON.parse(raw);
  } catch (error) {
    console.error('No se pudieron cargar las plantillas de encuestas.', error);
    process.exitCode = 1;
    return;
  }

  const apiBase = (args.api ?? process.env.CHATBOC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const token = args.token ?? process.env.CHATBOC_ADMIN_TOKEN;
  const publish = Boolean(args.publish);
  const dryRun = Boolean(args['dry-run']);

  if (!token && !dryRun) {
    console.error('Debés especificar un token de administración con --token o la variable CHATBOC_ADMIN_TOKEN.');
    process.exitCode = 1;
    return;
  }

  const results = [];

  for (const municipality of municipalities) {
    for (const template of templates) {
      const payload = buildPayload(template, municipality);

      if (dryRun) {
        results.push({ municipality, slug: payload.slug, created: false, dryRun: true });
        console.log(`[dry-run] Preparada encuesta "${payload.titulo}" para ${municipality}`);
        continue;
      }

      try {
        const response = await fetch(`${apiBase}/admin/encuestas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Error ${response.status}: ${errorBody}`);
        }

        const created = await response.json();
        results.push({ municipality, slug: payload.slug, created: true, id: created.id });
        console.log(`✅ Creada encuesta "${payload.titulo}" (ID ${created.id}) para ${municipality}`);

        if (publish && created?.id) {
          const publishResponse = await fetch(`${apiBase}/admin/encuestas/${created.id}/publicar`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!publishResponse.ok) {
            const publishBody = await publishResponse.text();
            throw new Error(`No se pudo publicar la encuesta ${created.id}: ${publishBody}`);
          }

          console.log(`🚀 Publicada encuesta con slug ${payload.slug}`);
        }
      } catch (error) {
        console.error(`❌ Falló la creación de la encuesta para ${municipality} (${template.slug}):`, error);
        results.push({ municipality, slug: payload.slug, created: false, error: String(error) });
      }
    }
  }

  if (dryRun) {
    console.log('\nResumen (dry-run):');
  } else {
    console.log('\nResumen:');
  }

  for (const result of results) {
    if (result.created) {
      console.log(`- ${result.municipality}: ${result.slug} (ID ${result.id})`);
    } else if (result.dryRun) {
      console.log(`- ${result.municipality}: ${result.slug} (pendiente de creación)`);
    } else {
      console.log(`- ${result.municipality}: ${result.slug} (error: ${result.error})`);
    }
  }
};

run().catch((error) => {
  console.error('Error inesperado al ejecutar el seed de encuestas.', error);
  process.exitCode = 1;
});
