const { getTickets } = require('./db');

// Helper to convert MS to hours
const msToHours = (ms) => (ms / (1000 * 60 * 60));

function getMunicipalStats(filters = {}) {
  let tickets = getTickets(); // Assuming getTickets() returns all tickets

  // Apply filters
  // Note: Ticket structure in db.js is { municipality, category, responseMs }
  // It does NOT have barrio, tipo, or a creation timestamp for date-based rangos.
  // Filters for barrio, tipo, and date-based rangos will not be effective with current db.js data.

  if (filters.rubro) {
    tickets = tickets.filter(t => t.category === filters.rubro);
  }
  if (filters.barrio) {
    // Assuming a 'barrio' field exists in ticket data, which it currently doesn't
    // tickets = tickets.filter(t => t.barrio === filters.barrio);
  }
  if (filters.tipo) {
    // Assuming a 'tipo' field exists in ticket data, which it currently doesn't
    // tickets = tickets.filter(t => t.tipo === filters.tipo);
  }

  // Handle 'rango' filter
  // For rangos like 'Últimas 24hs', we'd need a ticket creation timestamp.
  // For simplicity, only handling response time based rangos for now.
  const now = Date.now();
  if (filters.rango) {
    switch (filters.rango) {
      case 'Respondido < 4hs':
        tickets = tickets.filter(t => t.responseMs !== undefined && msToHours(t.responseMs) < 4);
        break;
      case 'Respondido > 24hs':
        tickets = tickets.filter(t => t.responseMs !== undefined && msToHours(t.responseMs) > 24);
        break;
      // Cases for 'Últimas 24hs', 'Últimos 7 días', 'Últimos 30 días' would need a ticket.createdAt field
      // e.g. case 'Últimas 24hs': tickets = tickets.filter(t => t.createdAt > now - (24 * 60 * 60 * 1000)); break;
      default: // 'Todas' or unhandled time ranges
        break;
    }
  }

  // If no tickets match filters, return empty stats
  if (tickets.length === 0) {
    return { stats: [] };
  }

  // --- Generate StatItem[] based on filters and remaining tickets ---
  // This part needs to be dynamic based on what information is most relevant.
  // The frontend expects a simple list of {label, value}.

  const stats = [];
  let labelPrefix = "Total Tickets";
  if (filters.rubro) labelPrefix = `Tickets de ${filters.rubro}`;
  if (filters.rango && filters.rango !== 'Todas') {
    labelPrefix = `${labelPrefix} (${filters.rango})`;
  }

  stats.push({ label: labelPrefix, value: tickets.length });

  // Calculate average response time for the filtered tickets
  const totalResponseMs = tickets.reduce((acc, t) => acc + (t.responseMs || 0), 0);
  const ticketsWithResponseTime = tickets.filter(t => t.responseMs !== undefined).length;

  if (ticketsWithResponseTime > 0) {
    const avgResponseHours = msToHours(totalResponseMs / ticketsWithResponseTime);
    stats.push({ label: `Avg. Response Time (h) ${filters.rubro ? 'for ' + filters.rubro : ''} ${filters.rango && filters.rango !== 'Todas' ? '('+filters.rango+')' : ''}`.trim(), value: parseFloat(avgResponseHours.toFixed(2)) });
  }

  // Example: Add count by municipality if no specific rubro is selected
  if (!filters.rubro && tickets.length > 0) {
    const byMunicipality = tickets.reduce((acc, t) => {
      acc[t.municipality] = (acc[t.municipality] || 0) + 1;
      return acc;
    }, {});
    for (const mun in byMunicipality) {
      stats.push({label: `Tickets in ${mun}`, value: byMunicipality[mun]});
    }
  }

  // Example: Add count by category if a specific municipality IS selected (or no municipality filter exists)
  // and no specific category is selected
  if (!filters.rubro && tickets.length > 0) { // let's show categories if no specific rubro is filtered
      const byCategory = tickets.reduce((acc, t) => {
          if(t.category) {
            acc[t.category] = (acc[t.category] || 0) + 1;
          }
          return acc;
      }, {});
      for (const cat in byCategory) {
          stats.push({label: `Category: ${cat}`, value: byCategory[cat]});
      }
  }


  return { stats };
}

function getMunicipalStatsFiltersData() {
  const tickets = getTickets();
  const rubros = [...new Set(tickets.map(t => t.category).filter(Boolean))];

  // Placeholder for barrios and tipos as they are not in the current ticket data structure
  // These should ideally be derived from data or a more robust configuration
  const barrios = ['Barrio Default 1', 'Barrio Default 2']; // Placeholder
  const tipos = ['Tipo Default A', 'Tipo Default B']; // Placeholder

  // Static list for rangos for now
  const rangos = [
    'Todas',
    'Últimas 24hs',
    'Últimos 7 días',
    'Últimos 30 días',
    'Respondido < 4hs',
    'Respondido > 24hs',
  ];

  return {
    rubros,
    barrios,
    tipos,
    rangos,
  };
}

module.exports = { getMunicipalStats, getMunicipalStatsFiltersData };
