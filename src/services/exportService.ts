// src/services/exportService.ts
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

// Extend jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const exportToPdf = (tickets: any[], columns: string[]) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const tableData = tickets.map((ticket) =>
    columns.map((column) => ticket[column])
  );

  doc.autoTable({
    head: [columns],
    body: tableData,
  });

  doc.save("tickets.pdf");
};

export const exportToExcel = (tickets: any[], columns: string[]) => {
  const worksheet = XLSX.utils.json_to_sheet(tickets, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");
  XLSX.writeFile(workbook, "tickets.xlsx");
};
