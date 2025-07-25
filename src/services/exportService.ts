import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Ticket, Message } from '@/types/tickets';

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

const getTicketData = (ticket: Ticket) => {
  return {
    'Ticket ID': ticket.nro_ticket,
    'Asunto': ticket.asunto,
    'Estado': ticket.estado,
    'Categoría': ticket.categoria || 'N/A',
    'Fecha de Creación': formatDate(ticket.fecha),
    'Cliente': ticket.name || 'Usuario Desconocido',
    'Email': ticket.email || 'N/A',
    'Teléfono': ticket.telefono || 'N/A',
    'Dirección': ticket.direccion || 'N/A',
  };
};

export const exportToPdf = (ticket: Ticket, messages: Message[]) => {
  const doc = new jsPDF();
  const ticketData = getTicketData(ticket);

  // Header
  doc.setFontSize(20);
  doc.setTextColor(40);
  doc.text('Detalles del Ticket', 14, 22);

  // Ticket Details
  autoTable(doc, {
    startY: 30,
    head: [['Campo', 'Valor']],
    body: Object.entries(ticketData),
    theme: 'striped',
    headStyles: { fillColor: [22, 160, 133] },
  });

  // Messages History
  if (messages.length > 0) {
    doc.addPage();
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('Historial de Mensajes', 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [['Fecha', 'Autor', 'Mensaje']],
      body: messages.map(msg => [
        formatDate(msg.timestamp),
        msg.author === 'agent' ? (msg.agentName || 'Agente') : 'Usuario',
        msg.content,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [22, 160, 133] },
    });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
  }

  doc.save(`ticket_${ticket.nro_ticket}.pdf`);
};

export const exportToXlsx = (ticket: Ticket, messages: Message[]) => {
  const ticketData = getTicketData(ticket);
  const ticketWorksheet = XLSX.utils.json_to_sheet(ticketData.map(item => ({ Campo: item.title, Valor: item.data })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ticketWorksheet, 'Detalles del Ticket');

  if (messages.length > 0) {
    const messagesWorksheet = XLSX.utils.json_to_sheet(
      messages.map(msg => ({
        Fecha: formatDate(msg.timestamp),
        Autor: msg.author === 'agent' ? (msg.agentName || 'Agente') : 'Usuario',
        Mensaje: msg.content,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, messagesWorksheet, 'Historial de Mensajes');
  }

  XLSX.writeFile(workbook, `ticket_${ticket.nro_ticket}.xlsx`);
};

export const exportToExcel = (tickets: Ticket[]) => {
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4F81BD" } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  const sheetData = tickets.map(ticket => ({
    'ID': ticket.nro_ticket,
    'Asunto': ticket.asunto,
    'Estado': ticket.estado,
    'Fecha': new Date(ticket.fecha).toLocaleString(),
    'Cliente': ticket.name || 'Desconocido',
    'Email': ticket.email || '',
    'Teléfono': ticket.telefono || '',
    'Dirección': ticket.direccion || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);

  // Apply styles to header
  const header = Object.keys(sheetData[0]);
  for (let i = 0; i < header.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ c: i, r: 0 });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = headerStyle;
    }
  }

  // Adjust column widths
  const colWidths = header.map(key => ({
    wch: Math.max(
      key.length,
      ...sheetData.map(row => (row[key as keyof typeof row] ? row[key as keyof typeof row].toString().length : 0))
    ) + 2
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

  XLSX.writeFile(workbook, 'tickets.xlsx');
};

export const exportAllToPdf = (tickets: Ticket[]) => {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text('Resumen de Tickets', 14, 22);

  autoTable(doc, {
    startY: 30,
    head: [['ID', 'Asunto', 'Estado', 'Cliente', 'Fecha']],
    body: tickets.map(ticket => [
      ticket.nro_ticket,
      ticket.asunto,
      ticket.estado,
      ticket.name || 'N/A',
      formatDate(ticket.fecha),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [22, 160, 133] },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
  }

  doc.save('resumen_tickets.pdf');
};
