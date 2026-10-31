import { jsPDF } from 'jspdf';

// Helper to draw vector icons in jsPDF
export function drawVectorIcon(
  doc: jsPDF,
  type: string,
  x: number,
  y: number,
  color: [number, number, number] = [255, 107, 0],
  size: number = 3
) {
  doc.saveGraphicsState();
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.3);

  switch (type) {
    case 'user': // 👤
      doc.circle(x, y - size * 0.35, size * 0.35, 'F');
      doc.ellipse(x, y + size * 0.5, size * 0.6, size * 0.35, 'F');
      break;

    case 'id': // 🪪
      doc.roundedRect(x - size * 0.6, y - size * 0.45, size * 1.2, size * 0.9, 0.2, 0.2, 'F');
      doc.setFillColor(255, 255, 255);
      doc.circle(x - size * 0.25, y, size * 0.25, 'F');
      doc.rect(x + size * 0.05, y - size * 0.2, size * 0.4, size * 0.1, 'F');
      doc.rect(x + size * 0.05, y + size * 0.05, size * 0.4, size * 0.1, 'F');
      break;

    case 'building': // 🏢
      doc.rect(x - size * 0.5, y - size * 0.6, size * 1, size * 1.2, 'F');
      doc.setFillColor(255, 255, 255);
      doc.rect(x - size * 0.3, y - size * 0.4, size * 0.2, size * 0.2, 'F');
      doc.rect(x + size * 0.1, y - size * 0.4, size * 0.2, size * 0.2, 'F');
      doc.rect(x - size * 0.3, y - size * 0.1, size * 0.2, size * 0.2, 'F');
      doc.rect(x + size * 0.1, y - size * 0.1, size * 0.2, size * 0.2, 'F');
      break;

    case 'email': // ✉️
      doc.rect(x - size * 0.6, y - size * 0.4, size * 1.2, size * 0.8, 'S');
      doc.line(x - size * 0.6, y - size * 0.4, x, y);
      doc.line(x, y, x + size * 0.6, y - size * 0.4);
      break;

    case 'mapPin': // 📍
      doc.circle(x, y - size * 0.2, size * 0.4, 'F');
      doc.triangle(x - size * 0.35, y - size * 0.1, x + size * 0.35, y - size * 0.1, x, y + size * 0.5, 'F');
      doc.setFillColor(255, 255, 255);
      doc.circle(x, y - size * 0.2, size * 0.15, 'F');
      break;

    case 'phone': // 📞
      doc.circle(x - size * 0.2, y + size * 0.2, size * 0.3, 'F');
      doc.circle(x + size * 0.2, y - size * 0.2, size * 0.3, 'F');
      doc.line(x - size * 0.2, y + size * 0.2, x + size * 0.2, y - size * 0.2);
      break;

    case 'calendar': // 📅
      doc.roundedRect(x - size * 0.5, y - size * 0.4, size * 1, size * 0.9, 0.2, 0.2, 'S');
      doc.line(x - size * 0.5, y - size * 0.1, x + size * 0.5, y - size * 0.1);
      doc.rect(x - size * 0.3, y - size * 0.55, size * 0.1, size * 0.25, 'F');
      doc.rect(x + size * 0.2, y - size * 0.55, size * 0.1, size * 0.25, 'F');
      break;

    case 'document': // 📄
      doc.rect(x - size * 0.45, y - size * 0.55, size * 0.9, size * 1.1, 'S');
      doc.line(x - size * 0.25, y - size * 0.25, x + size * 0.25, y - size * 0.25);
      doc.line(x - size * 0.25, y, x + size * 0.25, y);
      doc.line(x - size * 0.25, y + size * 0.25, x + size * 0.1, y + size * 0.25);
      break;

    case 'box': // 📦
      doc.rect(x - size * 0.5, y - size * 0.4, size * 1, size * 0.8, 'S');
      doc.line(x - size * 0.5, y - size * 0.4, x, y - size * 0.1);
      doc.line(x + size * 0.5, y - size * 0.4, x, y - size * 0.1);
      doc.line(x, y - size * 0.1, x, y + size * 0.4);
      break;

    case 'shield': // 🛡️
      doc.triangle(x - size * 0.5, y - size * 0.4, x + size * 0.5, y - size * 0.4, x, y + size * 0.5, 'F');
      doc.circle(x, y - size * 0.3, size * 0.5, 'F');
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.4);
      doc.line(x - size * 0.25, y - size * 0.05, x - size * 0.05, y + size * 0.15);
      doc.line(x - size * 0.05, y + size * 0.15, x + size * 0.25, y - size * 0.2);
      break;

    case 'pencil': // ✏️
      doc.line(x - size * 0.4, y + size * 0.4, x + size * 0.3, y - size * 0.3);
      doc.triangle(x - size * 0.5, y + size * 0.5, x - size * 0.3, y + size * 0.5, x - size * 0.5, y + size * 0.3, 'F');
      break;

    case 'truck': // 🚚
      doc.rect(x - size * 0.6, y - size * 0.3, size * 0.7, size * 0.5, 'F');
      doc.rect(x + size * 0.1, y - size * 0.1, size * 0.4, size * 0.3, 'F');
      doc.setFillColor(15, 23, 42);
      doc.circle(x - size * 0.3, y + size * 0.25, size * 0.18, 'F');
      doc.circle(x + size * 0.3, y + size * 0.25, size * 0.18, 'F');
      break;

    case 'checkSquare': // ☑️
      doc.rect(x - size * 0.45, y - size * 0.45, size * 0.9, size * 0.9, 'S');
      doc.setLineWidth(0.4);
      doc.line(x - size * 0.25, y, x - size * 0.05, y + size * 0.2);
      doc.line(x - size * 0.05, y + size * 0.2, x + size * 0.25, y - size * 0.2);
      break;

    case 'cart': // 🛒
    default:
      doc.line(x - size * 0.6, y - size * 0.4, x - size * 0.4, y - size * 0.4);
      doc.line(x - size * 0.4, y - size * 0.4, x - size * 0.2, y + size * 0.2);
      doc.line(x - size * 0.2, y + size * 0.2, x + size * 0.5, y + size * 0.2);
      doc.line(x + size * 0.5, y + size * 0.2, x + size * 0.6, y - size * 0.3);
      doc.line(x + size * 0.6, y - size * 0.3, x - size * 0.35, y - size * 0.3);
      doc.circle(x - size * 0.1, y + size * 0.35, size * 0.15, 'F');
      doc.circle(x + size * 0.35, y + size * 0.35, size * 0.15, 'F');
      break;
  }

  doc.restoreGraphicsState();
}

// Draw a circular badge with an icon inside
export function drawCircleBadge(
  doc: jsPDF,
  x: number,
  y: number,
  radius: number,
  bgColor: [number, number, number] = [255, 107, 0],
  iconType: string = 'user',
  iconColor: [number, number, number] = [255, 255, 255]
) {
  doc.saveGraphicsState();
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.circle(x, y, radius, 'F');
  drawVectorIcon(doc, iconType, x, y, iconColor, radius * 0.85);
  doc.restoreGraphicsState();
}

export interface HeaderOptions {
  title?: string;
  subtitle?: string;
  orderNumber?: string;
  orderLabel?: string;
  dateTimeStr?: string;
  regionStr?: string;
  phoneStr?: string;
  sellerStr?: string;
}

export function drawPDFHeader(doc: jsPDF, options: HeaderOptions) {
  const pageWidth = doc.internal.pageSize.width;

  // 1. Full-width Dark Navy Background Header (No white cut or white stripe)
  doc.setFillColor(15, 23, 42); // Dark Navy Slate #0F172A
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Decorative Orange Accent Line at bottom edge of navy header
  doc.setFillColor(255, 107, 0); // Bright Orange #FF6B00
  doc.rect(0, 37.2, pageWidth, 0.8, 'F');

  // Decorative Orange polygon cuts top-right inside dark header
  doc.setFillColor(255, 107, 0);
  doc.triangle(pageWidth - 30, 0, pageWidth, 0, pageWidth, 15, 'F');

  // Decorative dots pattern top left
  doc.setFillColor(255, 107, 0);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      doc.circle(8 + col * 3, 5 + row * 3, 0.6, 'F');
    }
  }

  // Brand Name & Shopping Cart Icon
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('VENDAS', 14, 16);

  doc.setTextColor(255, 107, 0);
  doc.text('HBN1', 60, 16);

  // Cart Icon with checkmark badge next to Brand
  drawCircleBadge(doc, 88, 13, 5.5, [255, 107, 0], 'cart', [255, 255, 255]);

  // Subtitle
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(options.subtitle || 'COMPROVANTE DE PEDIDO', 14, 23);

  // Contact info line 1 (Location, Phone, Seller)
  const contactY = 29;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(226, 232, 240);

  let curX = 14;

  // Location
  drawVectorIcon(doc, 'mapPin', curX + 1.5, contactY - 1, [255, 107, 0], 2.2);
  doc.text(options.regionStr || 'TERESINA - PI', curX + 5, contactY);
  curX += doc.getTextWidth(options.regionStr || 'TERESINA - PI') + 9;

  doc.text('|', curX, contactY);
  curX += 4;

  // Phone
  drawVectorIcon(doc, 'phone', curX + 1.5, contactY - 1, [255, 107, 0], 2.2);
  const phoneVal = options.phoneStr || '86 99964-7573';
  doc.text(phoneVal, curX + 5, contactY);
  curX += doc.getTextWidth(phoneVal) + 9;

  doc.text('|', curX, contactY);
  curX += 4;

  // Seller
  drawVectorIcon(doc, 'user', curX + 1.5, contactY - 1, [255, 107, 0], 2.2);
  doc.text(options.sellerStr || 'LEONEL', curX + 5, contactY);

  // Contact info line 2 (Calendar / Date & Time)
  const dateY = 34;
  drawVectorIcon(doc, 'calendar', 15.5, dateY - 1, [255, 107, 0], 2.2);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(options.dateTimeStr || new Date().toLocaleString('pt-BR'), 19, dateY);

  // 2. Right Side Order Identification Card (Floating on Dark Navy background with Orange border)
  const cardWidth = 62;
  const cardHeight = 28;
  const cardX = pageWidth - 14 - cardWidth;
  const cardY = 5;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 107, 0);
  doc.setLineWidth(0.5);
  doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'FD');

  // Orange top accent border on card
  doc.setFillColor(255, 107, 0);
  doc.roundedRect(cardX, cardY, cardWidth, 2.5, 1.5, 1.5, 'F');

  // Document Icon Badge on top-left inside card
  drawCircleBadge(doc, cardX + 10, cardY + 12, 5, [255, 107, 0], 'document', [255, 255, 255]);

  // Clean Order Number string or Catalog identifier
  let orderNumStr = options.orderNumber || 'PED1785350359114';
  let cardLabel = options.orderLabel || 'Nº DO PEDIDO';

  if (orderNumStr === 'CATÁLOGO' || orderNumStr.startsWith('CAT') || options.subtitle?.includes('CATÁLOGO')) {
    if (!options.orderNumber) orderNumStr = 'CATÁLOGO';
    if (!options.orderLabel) cardLabel = 'DOCUMENTO';
  } else if (!orderNumStr || orderNumStr.includes('NOVAFARMA') || orderNumStr === 'PEDIDO' || !/\d/.test(orderNumStr)) {
    orderNumStr = 'PED1785350359114';
  } else if (!orderNumStr.startsWith('PED')) {
    orderNumStr = `PED${orderNumStr}`;
  }

  // Text inside card
  const textLeftX = cardX + 18;

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text(cardLabel, textLeftX, cardY + 9);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const trunOrderNum = doc.splitTextToSize(orderNumStr, cardWidth - 20)[0];
  doc.text(trunOrderNum, textLeftX, cardY + 14.5);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DATA / HORA', textLeftX, cardY + 19.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(options.dateTimeStr || new Date().toLocaleString('pt-BR'), textLeftX, cardY + 24);
}

export function drawClientDataCard(
  doc: jsPDF,
  startY: number,
  clientFields: { icon: string; label: string; value: string }[]
): number {
  const pageWidth = doc.internal.pageSize.width;
  const cardX = 14;
  const cardW = pageWidth - 28;

  // Header Title with Badge
  drawCircleBadge(doc, cardX + 5, startY + 4, 3.5, [255, 107, 0], 'user', [255, 255, 255]);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DADOS DO CLIENTE', cardX + 11, startY + 5);

  // Underline bar under title
  doc.setFillColor(255, 107, 0);
  doc.rect(cardX + 11, startY + 6.5, 22, 0.8, 'F');

  // Card Outer Border Box
  const contentY = startY + 9;
  const rows = Math.ceil(clientFields.length / 2);
  const rowH = 6;
  const cardH = rows * rowH + 4;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(cardX, contentY, cardW, cardH, 2, 2, 'FD');

  const col1X = cardX + 4;
  const col2X = cardX + (cardW / 2) + 2;

  clientFields.forEach((item, idx) => {
    const isCol2 = idx % 2 === 1;
    const rIdx = Math.floor(idx / 2);
    const x = isCol2 ? col2X : col1X;
    const y = contentY + 5 + rIdx * rowH;

    // Field icon inside orange circle outline or circle
    drawVectorIcon(doc, item.icon || 'user', x + 2, y - 1, [255, 107, 0], 2.2);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${item.label}:`, x + 6, y);

    const labelW = doc.getTextWidth(`${item.label}: `);
    const maxValW = (cardW / 2) - labelW - 10;
    const valStr = item.value || '-';
    const truncatedVal = doc.splitTextToSize(valStr, maxValW)[0] || '-';

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(truncatedVal, x + 6 + labelW, y);
  });

  return contentY + cardH + 6;
}

export function drawSupplierHeaderBar(doc: jsPDF, startY: number, supplierName: string) {
  const pageWidth = doc.internal.pageSize.width;
  const barX = 14;
  const barW = pageWidth - 28;

  doc.setFillColor(15, 23, 42); // Navy Slate #0F172A
  doc.roundedRect(barX, startY, barW, 8, 1.5, 1.5, 'F');

  // Box Icon
  drawCircleBadge(doc, barX + 6, startY + 4, 3, [255, 107, 0], 'box', [255, 255, 255]);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`INDÚSTRIA: ${(supplierName || 'GERAL').toUpperCase()}`, barX + 12, startY + 5.5);
}

export function drawBottomSummaryCards(
  doc: jsPDF,
  startY: number,
  totals: { subtotal: number; discount: number; noStock?: number; finalTotal: number },
  options?: { title?: string; totalLabel?: string }
): number {
  const pageWidth = doc.internal.pageSize.width;
  const cardTitle = options?.title || 'Resumo do Pedido';
  const totalLabel = options?.totalLabel || 'TOTAL A PAGAR';

  if (startY > 220) {
    doc.addPage();
    startY = 20;
  }

  const cardW = pageWidth - 28;
  const cardX = 14;

  let contentRows = 1; // Subtotal
  if (totals.discount && totals.discount > 0) contentRows++;
  if (totals.noStock && totals.noStock > 0) contentRows++;

  const cardH = 12 + contentRows * 5.5 + 10;

  // Full-width Resumo Card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(cardX, startY, cardW, cardH, 2, 2, 'FD');

  // Header Title with Document Icon
  drawCircleBadge(doc, cardX + 6, startY + 5, 3.5, [255, 107, 0], 'document', [255, 255, 255]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(cardTitle, cardX + 12, startY + 6);

  const titleWidth = Math.min(60, Math.max(22, cardTitle.length * 2));
  doc.setFillColor(255, 107, 0);
  doc.rect(cardX + 12, startY + 7.5, titleWidth, 0.8, 'F');

  let curRowY = startY + 14;

  // Subtotal row
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('SUBTOTAL (TABELA):', cardX + 6, curRowY);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `R$ ${totals.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    cardX + cardW - 6,
    curRowY,
    { align: 'right' }
  );

  // No stock row (SEM ESTOQUE) - Second row
  if (totals.noStock && totals.noStock > 0) {
    curRowY += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('SEM ESTOQUE:', cardX + 6, curRowY);
    doc.text(
      `- R$ ${totals.noStock.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      cardX + cardW - 6,
      curRowY,
      { align: 'right' }
    );
  }

  // Discount row (DESCONTO TOTAL) - Third row
  if (totals.discount && totals.discount > 0) {
    curRowY += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('DESCONTO TOTAL:', cardX + 6, curRowY);
    doc.text(
      `- R$ ${totals.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      cardX + cardW - 6,
      curRowY,
      { align: 'right' }
    );
  }

  // Total a Pagar filled bar at bottom of card
  const totalBarY = curRowY + 4;
  doc.setFillColor(255, 107, 0); // Bright Orange #FF6B00
  doc.roundedRect(cardX, totalBarY, cardW, 10, 1.5, 1.5, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(totalLabel, cardX + 8, totalBarY + 6.5);

  doc.setFontSize(10.5);
  doc.text(
    `R$ ${totals.finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    cardX + cardW - 8,
    totalBarY + 6.5,
    { align: 'right' }
  );

  return totalBarY + 14;
}

export function drawObservationsBox(_doc: jsPDF, startY: number, _obsText?: string): number {
  return startY;
}

export function drawPDFFooterStrip(
  doc: jsPDF,
  profile?: any,
  regionStr: string = 'TERESINA - PI'
) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.height - 10;

    // Dark Navy Footer Bar
    doc.setFillColor(15, 23, 42); // Navy Slate #0F172A
    doc.rect(0, footerY - 2, pageWidth, 12, 'F');

    // Orange bottom line
    doc.setFillColor(255, 107, 0);
    doc.rect(0, footerY - 2, pageWidth, 0.8, 'F');

    let curX = 14;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    // Box Icon + Brand Name
    drawVectorIcon(doc, 'box', curX + 1, footerY + 3, [255, 107, 0], 2);
    doc.text('VENDAS HBN1', curX + 4, footerY + 4);
    curX += doc.getTextWidth('VENDAS HBN1') + 10;

    // Location
    drawVectorIcon(doc, 'mapPin', curX + 1, footerY + 3, [255, 107, 0], 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(regionStr, curX + 4, footerY + 4);
    curX += doc.getTextWidth(regionStr) + 10;

    // Phone
    drawVectorIcon(doc, 'phone', curX + 1, footerY + 3, [255, 107, 0], 2);
    const phone = profile?.phone || '(86) 99964-7573';
    doc.text(phone, curX + 4, footerY + 4);
    curX += doc.getTextWidth(phone) + 10;

    // Seller
    drawVectorIcon(doc, 'user', curX + 1, footerY + 3, [255, 107, 0], 2);
    const seller = profile?.name || 'Leonel';
    doc.text(seller, curX + 4, footerY + 4);

    // Right side: Issued at + Page Number
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    const rightText = `Emitido em: ${new Date().toLocaleString('pt-BR')}  |  Pág. ${i}/${pageCount}`;
    doc.text(rightText, pageWidth - 14, footerY + 4, { align: 'right' });
  }
}
