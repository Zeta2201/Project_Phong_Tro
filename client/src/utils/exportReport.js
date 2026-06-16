import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatDateForFile = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
};

const normalizeCell = (value) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleString('vi-VN');
    if (typeof value === 'boolean') return value ? 'Có' : 'Không';
    return value;
};

export const formatCurrency = (amount) => `${Number(amount || 0).toLocaleString('vi-VN')} VND`;

export const exportRowsToExcel = ({ fileName, sheets }) => {
    const workbook = XLSX.utils.book_new();

    sheets.forEach((sheet) => {
        const rows = (sheet.rows || []).map((row) =>
            Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeCell(value)])),
        );
        const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Thông báo': 'Không có dữ liệu' }]);
        const headers = Object.keys(rows[0] || { 'Thông báo': '' });
        worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 4, 18) }));
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
    });

    XLSX.writeFile(workbook, `${fileName}_${formatDateForFile()}.xlsx`);
};

export const exportRevenuePdf = ({ fileName, title, summaryRows, transactionRows }) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.text(`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`, 40, 58);

    autoTable(doc, {
        startY: 80,
        head: [['Chi tiêu', 'Giá trị']],
        body: summaryRows,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [24, 71, 127] },
    });

    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 24,
        head: [['Người dùng', 'Số tiền', 'Phương thức', 'Trạng thái', 'Ngày tạo']],
        body: transactionRows,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [24, 71, 127] },
    });

    doc.save(`${fileName}_${formatDateForFile()}.pdf`);
};
