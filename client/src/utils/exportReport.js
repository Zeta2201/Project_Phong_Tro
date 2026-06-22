import * as XLSX from 'xlsx';

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

const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

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
    const generatedAt = new Date().toLocaleString('vi-VN');
    const documentTitle = `${fileName}_${formatDateForFile()}`;
    const summaryHtml = (summaryRows || [])
        .map(
            ([label, value]) => `
                <tr>
                    <td>${escapeHtml(label)}</td>
                    <td>${escapeHtml(value)}</td>
                </tr>
            `,
        )
        .join('');
    const transactionHtml = (transactionRows || [])
        .map(
            (row) => `
                <tr>
                    ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
                </tr>
            `,
        )
        .join('');

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
        throw new Error('Khong the mo cua so in. Vui long cho phep popup de xuat PDF.');
    }

    printWindow.document.open();
    printWindow.document.write(`
        <!doctype html>
        <html lang="vi">
            <head>
                <meta charset="utf-8" />
                <title>${escapeHtml(documentTitle)}</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 16mm;
                    }

                    * {
                        box-sizing: border-box;
                    }

                    body {
                        margin: 0;
                        color: #1f2937;
                        font-family: Arial, "Helvetica Neue", Helvetica, "Segoe UI", sans-serif;
                        font-size: 12px;
                        line-height: 1.45;
                    }

                    h1 {
                        margin: 0 0 4px;
                        color: #111827;
                        font-size: 22px;
                        font-weight: 700;
                    }

                    .export-date {
                        margin: 0 0 26px;
                        color: #111827;
                        font-size: 13px;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 28px;
                        page-break-inside: auto;
                    }

                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }

                    th {
                        background: #18477f;
                        color: #fff;
                        font-weight: 700;
                        text-align: left;
                    }

                    th,
                    td {
                        border: 1px solid #d1d5db;
                        padding: 8px 10px;
                        vertical-align: top;
                    }

                    .transactions tbody tr:nth-child(odd) {
                        background: #f3f4f6;
                    }

                    @media print {
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(title)}</h1>
                <p class="export-date">Ngày xuất: ${escapeHtml(generatedAt)}</p>

                <table>
                    <thead>
                        <tr>
                            <th>Chỉ tiêu</th>
                            <th>Giá trị</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summaryHtml || '<tr><td colspan="2">Không có dữ liệu</td></tr>'}
                    </tbody>
                </table>

                <table class="transactions">
                    <thead>
                        <tr>
                            <th>Người dùng</th>
                            <th>Số tiền</th>
                            <th>Phương thức</th>
                            <th>Trạng thái</th>
                            <th>Ngày tạo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactionHtml || '<tr><td colspan="5">Không có dữ liệu</td></tr>'}
                    </tbody>
                </table>

                <script>
                    window.addEventListener('load', () => {
                        window.focus();
                        window.print();
                    });
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
    return;

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
