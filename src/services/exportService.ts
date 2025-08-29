import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Ticket, Message } from '@/types/tickets';
import { getContactPhone } from '@/utils/ticket';

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

const getTicketData = (ticket: Ticket) => {
  const data: { [key: string]: any } = {
    'Ticket ID': ticket.nro_ticket,
    'Asunto': ticket.asunto,
    'Estado': ticket.estado,
    'Categoría': ticket.categoria || 'N/A',
    'Fecha de Creación': formatDate(ticket.fecha),
    'Cliente': ticket.nombre_usuario || 'Usuario Desconocido',
    'Email': ticket.email_usuario || ticket.email || 'N/A',
    'Teléfono': getContactPhone(ticket) || 'N/A',
    'Dirección': ticket.direccion || 'N/A',
    'Canal': ticket.channel || 'N/A',
    'Descripción': ticket.description || 'N/A',
  };

  if (ticket.assignedAgent) {
    data['Agente Asignado'] = ticket.assignedAgent.nombre_usuario;
    data['Email Agente'] = ticket.assignedAgent.email || 'N/A';
    data['Teléfono Agente'] = ticket.assignedAgent.phone || 'N/A';
  }

  return data;
};

const addPdfHeader = (doc: jsPDF, title: string) => {
  // const logo = '... a base64 string ...'; // we will ask the user for this
  // doc.addImage(logo, 'PNG', 14, 12, 40, 15);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(45, 55, 72);
  doc.text(title, doc.internal.pageSize.width / 2, 20, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(14, 28, doc.internal.pageSize.width - 14, 28);
};

const addPdfFooter = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(10);
    doc.setTextColor(150);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        doc.text('© Chatboc', 14, doc.internal.pageSize.height - 10);
    }
}


export const exportToPdf = (ticket: Ticket, messages: Message[]) => {
  if (!ticket) return;
  const doc = new jsPDF();
  const ticketData = getTicketData(ticket);

  addPdfHeader(doc, `Ticket #${ticket.nro_ticket}`);

  // Ticket Details
  autoTable(doc, {
    startY: 40,
    head: [['Campo', 'Valor']],
    body: Object.entries(ticketData),
    theme: 'grid',
    headStyles: { fillColor: [79, 129, 189], textColor: 255 },
    styles: {
      font: 'helvetica',
      fontSize: 10
    }
  });

  // Messages History
  if (messages && messages.length > 0) {
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

  addPdfFooter(doc);
  doc.save(`ticket_${ticket.nro_ticket}.pdf`);
};

export const exportToXlsx = (ticket: Ticket, messages: Message[]) => {
  if (!ticket) return;
  const ticketData = getTicketData(ticket);
  const ticketWorksheet = XLSX.utils.json_to_sheet(Object.entries(ticketData).map(([key, value]) => ({ Campo: key, Valor: value })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ticketWorksheet, 'Detalles del Ticket');

  if (messages && messages.length > 0) {
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
    'Cliente': ticket.nombre_usuario || 'Desconocido',
    'Email': ticket.email_usuario || ticket.email || '',
    'Teléfono': getContactPhone(ticket) || '',
    'Dirección': ticket.direccion || '',
    'Canal': ticket.channel || '',
    'Descripción': ticket.description || '',
    'Agente Asignado': ticket.assignedAgent?.nombre_usuario || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);

  // Add a title row
  const title = 'Reporte de Tickets';
  const titleRow = [[title]];
  XLSX.utils.sheet_add_aoa(worksheet, titleRow, { origin: 'A1' });
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Object.keys(sheetData[0]).length - 1 } }];
  worksheet['A1'].s = {
    font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "2F5496" } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  // Apply styles to header
  const header = Object.keys(sheetData[0]);
  for (let i = 0; i < header.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ c: i, r: 1 });
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
  addPdfHeader(doc, 'Resumen de Tickets');

  autoTable(doc, {
    startY: 40,
    head: [['ID', 'Asunto', 'Estado', 'Cliente', 'Fecha', 'Canal', 'Agente']],
    body: tickets.map(ticket => [
      ticket.nro_ticket,
      ticket.asunto,
      ticket.estado,
      ticket.nombre_usuario || 'N/A',
      formatDate(ticket.fecha),
      ticket.channel || 'N/A',
      ticket.assignedAgent?.nombre_usuario || 'N/A',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [79, 129, 189], textColor: 255 },
    styles: {
        font: 'helvetica',
        fontSize: 10
    }
  });

  addPdfFooter(doc);
  doc.save('resumen_tickets.pdf');
};
