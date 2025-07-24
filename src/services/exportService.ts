import { Ticket } from '@/types/tickets';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Extender la interfaz de jsPDF para jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
}

export const exportToPdf = (tickets: Ticket[], category: string) => {
    const doc = new jsPDF();
    doc.text(`Tickets para la categoría: ${category}`, 14, 16);

    const tableColumn = ["Nro Ticket", "Asunto", "Estado", "Cliente", "Fecha"];
    const tableRows: any[] = [];

    tickets.forEach(ticket => {
        const ticketData = [
            ticket.nro_ticket,
            ticket.asunto,
            ticket.estado,
            ticket.name || 'N/A',
            formatDate(ticket.fecha)
        ];
        tableRows.push(ticketData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
    });

    doc.save(`tickets_${category}_${new Date().toISOString()}.pdf`);
}

export const exportToExcel = (tickets: Ticket[], category: string) => {
    const worksheetData = tickets.map(ticket => ({
        "Nro Ticket": ticket.nro_ticket,
        "Asunto": ticket.asunto,
        "Estado": ticket.estado,
        "Cliente": ticket.name || 'N/A',
        "Email": ticket.email || 'N/A',
        "Teléfono": ticket.telefono || 'N/A',
        "Fecha": formatDate(ticket.fecha),
        "Dirección": ticket.direccion || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");

    XLSX.writeFile(workbook, `tickets_${category}_${new Date().toISOString()}.xlsx`);
}
