import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportToPdf = (data: any[], columns: any[], title: string) => {
  const doc = new jsPDF();
  doc.text(title, 14, 15);
  (doc as any).autoTable({
    head: [columns.map(c => c.header)],
    body: data.map(row => columns.map(c => row[c.accessor])),
  });
  doc.save(`${title}.pdf`);
};
