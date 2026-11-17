import { deflateRawSync } from 'node:zlib';

export type ReportCell = string | number | boolean | null;

function escapeXml(value: string): string {
    return value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] as string);
}

function safeCell(value: ReportCell): ReportCell {
    if (typeof value !== 'string') return value;
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Array<{ name: string; data: Buffer }>): Buffer {
    const local: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const entry of entries) {
        const compressed = deflateRawSync(entry.data);
        const name = Buffer.from(entry.name);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(8, 6);
        header.writeUInt32LE(crc32(entry.data), 14);
        header.writeUInt32LE(compressed.length, 18);
        header.writeUInt32LE(entry.data.length, 22);
        header.writeUInt16LE(name.length, 26);
        local.push(header, name, compressed);

        const dir = Buffer.alloc(46);
        dir.writeUInt32LE(0x02014b50, 0);
        dir.writeUInt16LE(20, 4);
        dir.writeUInt16LE(20, 6);
        dir.writeUInt16LE(8, 8);
        dir.writeUInt32LE(crc32(entry.data), 16);
        dir.writeUInt32LE(compressed.length, 20);
        dir.writeUInt32LE(entry.data.length, 24);
        dir.writeUInt16LE(name.length, 28);
        dir.writeUInt32LE(offset, 42);
        central.push(dir, name);
        offset += header.length + name.length + compressed.length;
    }
    const centralData = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralData.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, centralData, end]);
}

export function toCsv(headers: string[], rows: ReportCell[][]): string {
    const quote = (value: ReportCell) => {
        const text = String(safeCell(value) ?? '');
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return `${[headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n')}\r\n`;
}

export function toXlsx(sheetName: string, headers: string[], rows: ReportCell[][]): Buffer {
    const allRows = [headers, ...rows];
    const cells = allRows.map((row, rowIndex) => {
        const values = row.map((raw, colIndex) => {
            const value = safeCell(raw);
            const ref = `${String.fromCharCode(65 + (colIndex % 26))}${rowIndex + 1}`;
            if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
            return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value ?? ''))}</t></is></c>`;
        }).join('');
        return `<row r="${rowIndex + 1}">${values}</row>`;
    }).join('');
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cells}</sheetData></worksheet>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
    return zip([
        { name: '[Content_Types].xml', data: Buffer.from(contentTypes) },
        { name: '_rels/.rels', data: Buffer.from(rels) },
        { name: 'xl/workbook.xml', data: Buffer.from(workbook) },
        { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels) },
        { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet) },
    ]);
}
