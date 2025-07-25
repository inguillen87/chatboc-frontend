// src/services/exportService.ts
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

// Extend jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const exportToPdf = (
  tickets: any[],
  columns?: string[] | "todos" | "all"
) => {
  const columnsToUse: string[] =
    !columns || columns === "todos" || columns === "all"
      ? Object.keys(tickets[0] || {})
      : columns;

  const doc = new jsPDF() as jsPDFWithAutoTable;
  const tableData = tickets.map((ticket) =>
    columnsToUse.map((column) => ticket[column])
  );

  doc.autoTable({
    head: [columnsToUse],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 8 },
  });

  doc.save("tickets.pdf");
};

export const exportToExcel = (
  tickets: any[],
  columns?: string[] | "todos" | "all"
) => {
  const columnsToUse: string[] =
    !columns || columns === "todos" || columns === "all"
      ? Object.keys(tickets[0] || {})
      : columns;

  const worksheetData = tickets.map((ticket) => {
    const row: Record<string, any> = {};
    columnsToUse.forEach((col) => {
      row[col] = ticket[col];
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData, {
    header: columnsToUse,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");
  XLSX.writeFile(workbook, "tickets.xlsx");
};
