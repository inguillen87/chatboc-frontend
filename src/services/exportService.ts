import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Ticket, Message } from '@/types/tickets';

interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

const getTicketData = (ticket: Ticket) => {
  return [
    { title: 'Ticket ID', data: ticket.nro_ticket },
    { title: 'Asunto', data: ticket.asunto },
    { title: 'Estado', data: ticket.estado },
    { title: 'Categoría', data: ticket.categoria || 'N/A' },
    { title: 'Fecha de Creación', data: formatDate(ticket.fecha) },
    { title: 'Cliente', data: ticket.name || 'Usuario Desconocido' },
    { title: 'Email', data: ticket.email || 'N/A' },
    { title: 'Teléfono', data: ticket.telefono || 'N/A' },
    { title: 'Dirección', data: ticket.direccion || 'N/A' },
  ];
};

export const exportToPdf = (ticket: Ticket, messages: Message[]) => {
  const doc = new jsPDF() as JsPDFWithAutoTable;
  const ticketData = getTicketData(ticket);

  doc.setFontSize(18);
  doc.text('Detalles del Ticket', 14, 22);

  doc.autoTable({
    startY: 30,
    head: [['Campo', 'Valor']],
    body: ticketData.map(item => [item.title, item.data]),
    theme: 'striped',
    styles: {
      fontSize: 10,
      cellPadding: 2,
    },
  });

  if (messages.length > 0) {
    doc.addPage();
    doc.setFontSize(18);
    doc.text('Historial de Mensajes', 14, 22);

    doc.autoTable({
      startY: 30,
      head: [['Fecha', 'Autor', 'Mensaje']],
      body: messages.map(msg => [
        formatDate(msg.timestamp),
        msg.author === 'agent' ? (msg.agentName || 'Agente') : 'Usuario',
        msg.content,
      ]),
      theme: 'striped',
      styles: {
        fontSize: 10,
        cellPadding: 2,
      },
    });
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
