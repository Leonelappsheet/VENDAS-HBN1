/**
 * GOOGLE APPS SCRIPT BACKEND FOR VENDAS HBN1
 * 
 * Este arquivo contém o código do backend que deve ser inserido no editor do Google Apps Script (Code.gs).
 * Ele gerencia o roteamento de requisições, leitura e escrita de dados diretamente nas abas do Google Sheets,
 * além do processamento inteligente do catálogo de produtos.
 */

function doGet(e) {
  var htmlOutput;
  try {
    htmlOutput = HtmlService.createTemplateFromFile('INDEX').evaluate();
  } catch (error) {
    try {
      htmlOutput = HtmlService.createTemplateFromFile('Index').evaluate();
    } catch (error2) {
      return HtmlService.createHtmlOutput(
        "<h1>Erro ao carregar o arquivo INDEX.html</h1>" +
        "<p>Por favor, certifique-se de que o arquivo HTML foi criado no seu projeto do Google Apps Script " +
        "com o nome exato de <b>INDEX</b> ou <b>Index</b> (e certifique-se de que o conteúdo de INDEX.HTML foi colado nele).</p>" +
        "<p>Detalhes do erro: " + error.message + "</p>"
      );
    }
  }
  
  return htmlOutput
    .setTitle('VENDAS HBN1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  // Configuração de CORS para responder requisições externas de forma limpa
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return buildJSONResponse({ error: "Nenhum dado recebido no corpo da requisição." });
    }
    
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var spreadsheetId = postData.spreadsheetId;
    
    if (!spreadsheetId) {
      return buildJSONResponse({ error: "Parâmetro 'spreadsheetId' é obrigatório." });
    }
    
    var responseData;
    
    switch (action) {
      case 'save-order':
        responseData = saveOrder(spreadsheetId, postData.order);
        break;
      case 'update-client':
        responseData = updateClient(spreadsheetId, postData.client);
        break;
      case 'update-catalog':
        responseData = updateCatalog(spreadsheetId, postData.industria, postData.dados, postData.defaultExpiryDate);
        break;
      case 'update-image':
        responseData = updateImage(spreadsheetId, postData.id, postData.imageUrl, postData.sheetName);
        break;
      case 'save-cart':
        responseData = saveCart(spreadsheetId, postData.clientId, postData.items);
        break;
      case 'get-cart':
        responseData = getCart(spreadsheetId, postData.clientId);
        break;
      default:
        responseData = { error: "Ação não suportada pelo Apps Script: " + action };
    }
    
    return buildJSONResponse(responseData);
  } catch (error) {
    return buildJSONResponse({ error: error.message || error.toString() });
  }
}

function buildJSONResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
}

/**
 * Normaliza o código EAN preenchendo com zeros à esquerda se necessário
 */
function normalizeEAN(ean) {
  if (ean === null || ean === undefined) return '';
  var s = String(ean).trim().replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.length > 0 && s.length < 13) {
    while (s.length < 13) {
      s = '0' + s;
    }
  }
  return s;
}

/**
 * Remove formatação monetária ou percentual de strings
 */
function cleanNumericString(val) {
  if (val === null || val === undefined) return "0";
  if (typeof val === 'number') return String(val);
  
  var s = String(val).replace('R$', '').replace('%', '').trim();
  if (!s) return "0";

  if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
    return s.replace(/\./g, '').replace(',', '.');
  }
  
  if (s.indexOf(',') !== -1) {
    return s.replace(',', '.');
  }

  var dotCount = (s.match(/\./g) || []).length;
  if (dotCount === 1) {
    return s;
  }
  
  if (dotCount > 1) {
    return s.replace(/\./g, '');
  }
  
  return s;
}

/**
 * Aplica regra personalizada de arredondamento
 */
function applyCustomRounding(val) {
  if (isNaN(val)) return 0;
  var s = val.toFixed(10);
  var parts = s.split('.');
  var rounded;
  if (parts.length >= 2 && parts[1].length >= 3) {
    var thirdDigit = parseInt(parts[1][2]);
    if (thirdDigit >= 6) {
      rounded = parseFloat((Math.ceil(val * 100) / 100).toFixed(2));
    } else {
      rounded = parseFloat((Math.floor(val * 100) / 100).toFixed(2));
    }
  } else {
    rounded = parseFloat(val.toFixed(2));
  }

  if (rounded === 0.99) return 1.00;
  return rounded;
}

/**
 * Formata número para salvar na planilha de modo amigável
 */
function formatBrazilian(num, isPercent) {
  var val = parseFloat(String(num).replace(',', '.'));
  if (isNaN(val)) return num;
  var s = val.toFixed(2);
  return isPercent ? s + '%' : s;
}

/**
 * Normaliza strings para comparação (remoção de acentos e case-insensitive)
 */
function normalizeStr(str) {
  return String(str || "").trim().toLowerCase()
    .replace(/[áàâãä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôõö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/[ç]/g, "c");
}

/**
 * Obtém a letra da coluna com base no índice numérico (0-indexed)
 */
function getColumnLetter(index) {
  var letter = "";
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

/**
 * Salva um novo pedido nas planilhas 'Pedidos' e 'ItensPedido'
 */
function saveOrder(spreadsheetId, order) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    // 1. Aba de Pedidos
    var sheetPedidos = ss.getSheetByName("Pedidos");
    if (!sheetPedidos) {
      return { error: "Aba 'Pedidos' não encontrada no arquivo do Sheets." };
    }
    
    var orderRow = [
      order.id,
      order.date,
      order.clientId,
      order.clientName,
      order.email,
      order.seller,
      order.phone,
      order.total,
      order.status,
      (order.items ? order.items.length : 0) + " itens",
      order.observation || "",
      order.pdfUrl || ""
    ];
    
    sheetPedidos.appendRow(orderRow);
    
    // 2. Aba de Itens do Pedido
    var sheetItens = ss.getSheetByName("ItensPedido");
    if (!sheetItens) {
      return { error: "Aba 'ItensPedido' não encontrada no arquivo do Sheets." };
    }
    
    if (order.items && order.items.length > 0) {
      var itemRows = [];
      for (var i = 0; i < order.items.length; i++) {
        var item = order.items[i];
        itemRows.push([
          order.id + "-" + (i + 1),
          order.id,
          item.id,
          item.ean || "",
          item.description,
          item.manufacturer || "",
          item.quantity,
          item.finalPrice,
          item.quantity * item.finalPrice
        ]);
      }
      
      var lastRow = sheetItens.getLastRow();
      var range = sheetItens.getRange(lastRow + 1, 1, itemRows.length, 9);
      range.setValues(itemRows);
    }
    
    return { sucesso: true, idPedido: order.id };
  } catch (error) {
    return { error: error.message || error.toString() };
  }
}

/**
 * Atualiza os dados cadastrais de um cliente na aba 'Clientes'
 */
function updateClient(spreadsheetId, client) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName("Clientes");
    if (!sheet) {
      return { error: "Aba 'Clientes' não encontrada ou vazia." };
    }
    
    var values = sheet.getDataRange().getValues();
    if (values.length === 0) {
      return { error: "Aba 'Clientes' está vazia." };
    }
    
    var headers = values[0];
    var idIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      if (normalizeStr(headers[i]).indexOf("id") !== -1) {
        idIdx = i;
        break;
      }
    }
    
    if (idIdx === -1) {
      return { error: "Coluna ID não encontrada na aba Clientes." };
    }
    
    var rowIdx = -1;
    for (var j = 1; j < values.length; j++) {
      if (String(values[j][idIdx]).trim() === String(client.id).trim()) {
        rowIdx = j;
        break;
      }
    }
    
    if (rowIdx === -1) {
      return { error: "Cliente com ID " + client.id + " não encontrado na planilha." };
    }
    
    var updatedRow = values[rowIdx];
    var mapping = {
      'Nome': 'name',
      'Nome Fantasia': 'tradeName',
      'CNPJ': 'cnpj',
      'Vendedor': 'seller',
      'EmailUsuario': 'email',
      'Endereco': 'address',
      'Cidade': 'city',
      'Estado': 'state',
      'Comprador': 'buyer',
      'Celular': 'phone',
      'Regional': 'regional'
    };
    
    for (var k = 0; k < headers.length; k++) {
      var headerName = headers[k];
      var key = mapping[headerName];
      if (key && client[key] !== undefined) {
        updatedRow[k] = client[key];
      }
    }
    
    var sheetRowNumber = rowIdx + 1;
    var range = sheet.getRange(sheetRowNumber, 1, 1, updatedRow.length);
    range.setValues([updatedRow]);
    
    return { sucesso: true, client: client };
  } catch (error) {
    return { error: error.message || error.toString() };
  }
}

/**
 * Atualiza o link/URL da foto de um produto na aba correspondente
 */
function updateImage(spreadsheetId, id, imageUrl, sheetName) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    var sheets = ss.getSheets();
    var targetSheet = null;
    var normSheetName = normalizeStr(sheetName);
    
    for (var i = 0; i < sheets.length; i++) {
      if (normalizeStr(sheets[i].getName()) === normSheetName) {
        targetSheet = sheets[i];
        break;
      }
    }
    
    if (!targetSheet) {
      targetSheet = ss.getSheetByName(sheetName);
    }
    if (!targetSheet) {
      return { error: "Aba '" + sheetName + "' não encontrada." };
    }
    
    var values = targetSheet.getDataRange().getValues();
    if (values.length === 0) {
      return { error: "Aba '" + targetSheet.getName() + "' está vazia." };
    }
    
    var headers = values[0];
    var idIdx = -1;
    var photoIdx = -1;
    
    for (var j = 0; j < headers.length; j++) {
      var normH = normalizeStr(headers[j]);
      if (["idproduto", "id", "codigo", "cod"].indexOf(normH) !== -1) {
        idIdx = j;
      }
      if (["foto", "imagem", "url", "photo", "link", "img"].indexOf(normH) !== -1 || normH.indexOf("foto") !== -1) {
        photoIdx = j;
      }
    }
    
    if (idIdx === -1) {
      return { error: "Coluna ID não encontrada na aba " + targetSheet.getName() };
    }
    
    var rowIdx = -1;
    for (var k = 1; k < values.length; k++) {
      if (String(values[k][idIdx]).trim() === String(id).trim()) {
        rowIdx = k;
        break;
      }
    }
    
    if (rowIdx === -1) {
      return { error: "Produto ID '" + id + "' não encontrado na aba " + targetSheet.getName() };
    }
    
    var targetPhotoIdx = photoIdx;
    if (targetPhotoIdx === -1) {
      targetPhotoIdx = headers.length;
      targetSheet.getRange(1, targetPhotoIdx + 1).setValue("Foto");
    }
    
    var sheetRowNumber = rowIdx + 1;
    targetSheet.getRange(sheetRowNumber, targetPhotoIdx + 1).setValue(imageUrl);
    
    return { success: true };
  } catch (error) {
    return { error: error.message || error.toString() };
  }
}

/**
 * Atualiza o catálogo de produtos de uma indústria específica nas abas Produtos, Ofertas e Lançamentos
 */
function updateCatalog(spreadsheetId, industria, dados, defaultExpiryDate) {
  try {
    if (!Array.isArray(dados) || dados.length === 0) {
      return { error: "Dados do catálogo estão vazios ou em formato inválido." };
    }
    
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheetsToSync = ["Produtos", "Ofertas", "Lancamentos"];
    
    var sheetData = {};
    var existingProductsMap = {};
    
    // Mapeamento padrão por indústria
    var INDUSTRY_MAPPINGS = {
      'DANONE': { id: 1, ean: 0, desc: 3, stock: 9, price: 5, discount: 4, final: 7 },
      'UNILEVER': { id: 1, ean: 2, desc: 3, stock: 7, price: 8, discount: 11, final: 12 }, 
      'KIMBERLY': { id: 1, ean: 1, desc: 2, stock: 3, price: 4, discount: 5, final: 6 },
      'KENVUE': { id: 5, ean: 3, desc: 4, stock: 13, price: 6, discount: 7, final: 8 },
      'OMRON': { id: 5, ean: 3, desc: 4, stock: 13, price: 6, discount: 7, final: 8 },
    };
    
    var targetIndustry = String(industria).split(' ')[0].trim().toUpperCase();
    var mapping = INDUSTRY_MAPPINGS[targetIndustry] || INDUSTRY_MAPPINGS['UNILEVER'];
    
    // 1. Ler as abas do Sheets
    for (var i = 0; i < sheetsToSync.length; i++) {
      var sName = sheetsToSync[i];
      var sheet = ss.getSheetByName(sName);
      if (sheet) {
        var allRows = sheet.getDataRange().getValues();
        if (allRows.length > 0) {
          sheetData[sName] = { rows: allRows, headers: allRows[0], sheetObj: sheet };
          
          for (var r = 1; r < allRows.length; r++) {
            var row = allRows[r];
            var pId = String(row[0] || "").trim();
            var rawEan = String(row[1] || "").trim().replace(/^'/, '');
            var pEan = normalizeEAN(rawEan);
            
            var entry = { row: row, sheetName: sName, rowIndex: r };
            
            if (pId && pId.length >= 2) {
              if (!existingProductsMap[pId]) existingProductsMap[pId] = [];
              existingProductsMap[pId].push(entry);
            }
            if (pEan) {
              if (!existingProductsMap[pEan]) existingProductsMap[pEan] = [];
              existingProductsMap[pEan].push(entry);
            }
          }
        }
      }
    }
    
    if (Object.keys(sheetData).length === 0) {
      return { error: "Nenhuma das abas de catálogo (Produtos/Ofertas/Lancamentos) foi encontrada na planilha." };
    }
    
    // Índices de destino nas planilhas (A=0, B=1, ...)
    var idIdx = 0;
    var eanIdx = 1;
    var descIdx = 2;
    var stockIdx = 3;
    var priceIdx = 4;
    var discIdx = 5;
    var finalIdx = 6;
    var validIdx = 7;
    
    // 2. Detectar cabeçalhos nos dados enviados
    var sourceHeaders = [];
    var headerRowIdx = -1;
    for (var idx = 0; idx < Math.min(10, dados.length); idx++) {
      var dRow = dados[idx];
      if (Array.isArray(dRow)) {
        var isHeader = false;
        for (var c = 0; c < dRow.length; c++) {
          var cellS = normalizeStr(dRow[c]);
          if (cellS.indexOf("ean") !== -1 || cellS.indexOf("codigo") !== -1 || cellS.indexOf("descri") !== -1 || cellS.indexOf("produto") !== -1) {
            isHeader = true;
            break;
          }
        }
        if (isHeader) {
          sourceHeaders = dRow.map(function(h) { return String(h || "").trim(); });
          headerRowIdx = idx;
          break;
        }
      }
    }
    
    var headerNormalized = sourceHeaders.map(function(h) { return normalizeStr(h); });
    
    var getSourceIndex = function(names) {
      var normNames = names.map(function(n) { return normalizeStr(n); });
      for (var a = 0; a < normNames.length; a++) {
        var fIndex = headerNormalized.indexOf(normNames[a]);
        if (fIndex !== -1) return fIndex;
      }
      for (var b = 0; b < normNames.length; b++) {
        if (normNames[b].length < 3) continue;
        for (var c = 0; c < headerNormalized.length; c++) {
          if (headerNormalized[c].indexOf(normNames[b]) === 0) return c;
        }
      }
      for (var d = 0; d < normNames.length; d++) {
        if (normNames[d].length < 4) continue;
        for (var e = 0; e < headerNormalized.length; e++) {
          if (headerNormalized[e].indexOf(normNames[d]) !== -1) return e;
        }
      }
      return -1;
    };
    
    var mappedIndices = {
      id: getSourceIndex(["IDProduto", "ID_Produto", "Codigo", "Cod", "Código", "CÓD", "CODIGO", "ID"]),
      ean: getSourceIndex(["EAN", "Codigo Barras", "Código de Barras", "EAN13", "GTIN", "BARRAS"]),
      desc: getSourceIndex(["Descrição", "Descricao", "Nome", "Produto", "Descricao Produto", "PRODUTO", "NOME"]),
      stock: getSourceIndex(["Estoque", "Sald", "Saldo", "QTDE", "Qtde", "Quant", "Quantidade", "STOCK", "DISPONIVEL", "QTD DISP", "ESTOQ", "ESTOQUE", "UNIDADES", "UNID"]),
      price: getSourceIndex(["PV", "Preço Venda", "Preco Venda", "PRECO", "PREÇO", "VALOR", "TABELA", "UNITARIO", "UNITÁRIO", "PREÇO UNITARIO", "VALOR UNITARIO"]),
      discount: getSourceIndex(["DESC", "Desconto", "DESCONTO", "PERCENTUAL", "BONUS", "%DESC", "DESC TOTAL"]),
      final: getSourceIndex(["PREÇO C/ DESC", "PRECO C/ DESC", "PRECO C DESC", "PF", "Preço Final", "Preco Final", "VALOR FINAL", "PRECO LIQUIDO", "PRECO LÍQUIDO", "VALOR LIQUIDO", "LIQUIDO"]),
      valid: getSourceIndex(["VALOR VALIDADE", "VALIDADE", "VENCIMENTO", "DATA FIM", "EXPIRA", "VALIDADE DESCONTO"])
    };
    
    var hasSourceHeaders = sourceHeaders.length > 0;
    var isKimberlyInput = targetIndustry.indexOf('KIMBERLY') !== -1;
    
    var rowsToProcess = headerRowIdx !== -1 ? dados.slice(headerRowIdx + 1) : dados;
    var log = [];
    var clearedProductIdsAndEans = [];
    var targetIndustryIdsAndEans = {};
    
    log.push("Iniciando atualização do catálogo " + industria + "...");
    log.push("Planilha detectada com " + rowsToProcess.length + " linhas de dados.");
    
    // Identificar produtos pertencentes a essa fabricante
    var prodSheetData = sheetData["Produtos"];
    if (prodSheetData) {
      var prodHeaders = prodSheetData.headers || [];
      var prodFabColIdx = -1;
      for (var f = 0; f < prodHeaders.length; f++) {
        if (normalizeStr(prodHeaders[f]).indexOf("fabricante") !== -1) {
          prodFabColIdx = f;
          break;
        }
      }
      
      if (prodFabColIdx !== -1) {
        for (var rNum = 1; rNum < prodSheetData.rows.length; rNum++) {
          var pRow = prodSheetData.rows[rNum];
          var rowFab = String(pRow[prodFabColIdx] || "").trim().toUpperCase();
          var matchesFab = rowFab === targetIndustry || rowFab.indexOf(targetIndustry) === 0 || targetIndustry.indexOf(rowFab) === 0;
          
          if (matchesFab) {
            var pId = String(pRow[0] || "").trim();
            var rawEan = String(pRow[1] || "").trim().replace(/^'/, '');
            var pEan = normalizeEAN(rawEan);
            
            if (pId) targetIndustryIdsAndEans[pId] = true;
            if (pEan) targetIndustryIdsAndEans[pEan] = true;
          }
        }
      }
    }
    
    // Limpar valores de estoque/preço dos produtos da fabricante que serão reimportados
    var clearedCountTotal = 0;
    Object.keys(sheetData).forEach(function(sName) {
      var sInfo = sheetData[sName];
      var sHeaders = sInfo.headers || [];
      var sFabIdx = -1;
      for (var hIdx = 0; hIdx < sHeaders.length; hIdx++) {
        if (normalizeStr(sHeaders[hIdx]).indexOf("fabricante") !== -1) {
          sFabIdx = hIdx;
          break;
        }
      }
      
      for (var rIdx = 1; rIdx < sInfo.rows.length; rIdx++) {
        var row = sInfo.rows[rIdx];
        var belongsToIndustry = false;
        
        if (sFabIdx !== -1 && row[sFabIdx]) {
          var rowFab = String(row[sFabIdx] || "").trim().toUpperCase();
          belongsToIndustry = rowFab === targetIndustry || rowFab.indexOf(targetIndustry) === 0 || targetIndustry.indexOf(rowFab) === 0;
        }
        
        if (!belongsToIndustry) {
          var pId = String(row[0] || "").trim();
          var rawEan = String(row[1] || "").trim().replace(/^'/, '');
          var pEan = normalizeEAN(rawEan);
          if ((pId && targetIndustryIdsAndEans[pId]) || (pEan && targetIndustryIdsAndEans[pEan])) {
            belongsToIndustry = true;
          }
        }
        
        if (belongsToIndustry) {
          var pId = String(row[0] || "").trim();
          var rawEan = String(row[1] || "").trim().replace(/^'/, '');
          var pEan = normalizeEAN(rawEan);
          var desc = String(row[2] || "").trim();
          
          var label = [
            desc ? '"' + desc + '"' : "",
            pId ? "ID: " + pId : "",
            pEan ? "EAN: " + pEan : ""
          ].filter(Boolean).join(" | ");
          
          if (label) clearedProductIdsAndEans.push(label);
          
          row[stockIdx] = "";
          row[priceIdx] = "";
          row[discIdx] = "";
          row[finalIdx] = "";
          clearedCountTotal++;
        }
      }
    });
    
    log.push("Varredura concluída: Limpos valores de [Estoque, Preco Venda, Desconto, Preco Final] de " + clearedCountTotal + " linhas de produtos antigos antes de aplicar os novos.");
    
    var updatedCount = 0;
    var newCount = 0;
    var newProductsRows = [];
    
    for (var d = 0; d < rowsToProcess.length; d++) {
      var item = rowsToProcess[d];
      var newId = "";
      var newEan = "";
      var newDesc = "";
      var newStock = "";
      var newPrice = "";
      var newDiscount = "";
      var newFinal = "";
      var newValid = "";
      
      if (Array.isArray(item)) {
        if (hasSourceHeaders) {
          newId = String(item[mappedIndices.id !== -1 ? mappedIndices.id : mapping.id] || "").trim();
          newEan = normalizeEAN(String(item[mappedIndices.ean !== -1 ? mappedIndices.ean : mapping.ean] || "").trim().replace(/^'/, ''));
          newDesc = String(item[mappedIndices.desc !== -1 ? mappedIndices.desc : mapping.desc] || "").trim();
          newStock = String(item[mappedIndices.stock !== -1 ? mappedIndices.stock : mapping.stock] || "").trim();
          newPrice = String(item[mappedIndices.price !== -1 ? mappedIndices.price : mapping.price] || "").trim();
          newDiscount = String(item[mappedIndices.discount !== -1 ? mappedIndices.discount : mapping.discount] || "").trim();
          newFinal = String(item[mappedIndices.final !== -1 ? mappedIndices.final : mapping.final] || "").trim();
          newValid = String(item[mappedIndices.valid !== -1 ? mappedIndices.valid : -1] || "").trim() || defaultExpiryDate || "";
          
          var pVal = parseFloat(cleanNumericString(newPrice));
          var fVal = parseFloat(cleanNumericString(newFinal));
          var dVal = parseFloat(cleanNumericString(newDiscount));
          
          if (isKimberlyInput) {
            if (pVal > 1000 && pVal % 1 === 0) pVal /= 100;
            if (fVal > 1000 && fVal % 1 === 0) fVal /= 100;
            if (dVal === 1) dVal = 10;
          }
          
          if (dVal > 1 && pVal > 1 && dVal < pVal && dVal > (pVal * 0.45) && !isKimberlyInput) {
            fVal = dVal;
            dVal = 0;
          }
          
          if (!isNaN(pVal) && pVal > 0) {
            newPrice = applyCustomRounding(pVal);
            var looksLikeTooMuchDiscount = isKimberlyInput && fVal > 0 && ((pVal - fVal) / pVal) > 0.4;
            
            if (!isNaN(fVal) && fVal > 0 && Math.abs(fVal - pVal) > 0.01 && !looksLikeTooMuchDiscount) {
              newFinal = applyCustomRounding(fVal);
              var calculatedDisc = ((pVal - fVal) / pVal) * 100;
              newDiscount = calculatedDisc > 0 ? applyCustomRounding(calculatedDisc) : 0;
            } else if (!isNaN(dVal) && dVal > 0) {
              var dPerc = dVal < 1 ? dVal * 100 : dVal;
              newDiscount = applyCustomRounding(dPerc);
              newFinal = applyCustomRounding(pVal * (1 - newDiscount / 100));
            } else {
              newFinal = newPrice;
              newDiscount = 0;
            }
          } else {
            newPrice = 0;
            newDiscount = applyCustomRounding(dVal);
            newFinal = applyCustomRounding(fVal);
          }
        } else {
          newId = String(item[mapping.id] || "").trim();
          newEan = normalizeEAN(String(item[mapping.ean] || "").trim().replace(/^'/, ''));
          newDesc = String(item[mapping.desc] || "").trim();
          newStock = String(item[mapping.stock] || "").trim();
          
          var pValRaw = parseFloat(cleanNumericString(item[mapping.price]));
          var fValRaw = parseFloat(cleanNumericString(item[mapping.final]));
          var dValRaw = parseFloat(cleanNumericString(item[mapping.discount]));
          
          if (isKimberlyInput) {
            if (pValRaw > 1000 && pValRaw % 1 === 0) pValRaw /= 100;
            if (fValRaw > 1000 && fValRaw % 1 === 0) fValRaw /= 100;
            if (dValRaw === 1) dValRaw = 10;
          }
          
          if (!isNaN(pValRaw) && pValRaw > 0) {
            newPrice = applyCustomRounding(pValRaw);
            var looksTooMuch = isKimberlyInput && fValRaw > 0 && ((pValRaw - fValRaw) / pValRaw) > 0.4;
            
            if (!isNaN(fValRaw) && fValRaw > 0 && Math.abs(fValRaw - pValRaw) > 0.01 && !looksTooMuch) {
              newFinal = applyCustomRounding(fValRaw);
              var calculated = ((pValRaw - fValRaw) / pValRaw) * 100;
              newDiscount = calculated > 0 ? applyCustomRounding(calculated) : 0;
            } else if (!isNaN(dValRaw) && dValRaw > 0) {
              var dPerc = dValRaw < 1 ? dValRaw * 100 : dValRaw;
              newDiscount = applyCustomRounding(dPerc);
              newFinal = applyCustomRounding(pValRaw * (1 - newDiscount / 100));
            } else {
              newFinal = newPrice;
              newDiscount = 0;
            }
          } else {
            newPrice = 0;
            newDiscount = applyCustomRounding(dValRaw);
            newFinal = applyCustomRounding(fValRaw);
          }
        }
      }
      
      var isJunk = !newId && !newEan;
      var isHeaderRepeat = normalizeStr(newDesc).indexOf("descri") !== -1 || normalizeStr(newId).indexOf("id") !== -1 || normalizeStr(newEan).indexOf("ean") !== -1;
      
      if (isJunk || isHeaderRepeat) continue;
      
      // Remover dos itens limpos
      for (var cl = clearedProductIdsAndEans.length - 1; cl >= 0; cl--) {
        var label = clearedProductIdsAndEans[cl];
        if ((newId && label.indexOf("ID: " + newId) !== -1) || 
            (newEan && label.indexOf("EAN: " + newEan) !== -1) || 
            (newDesc && label.indexOf('"' + newDesc + '"') !== -1)) {
          clearedProductIdsAndEans.splice(cl, 1);
        }
      }
      
      var matchingEntriesById = newId ? (existingProductsMap[newId] || []) : [];
      var matchingEntriesByEan = newEan ? (existingProductsMap[newEan] || []) : [];
      
      var allMatchingEntriesMap = {};
      var allMatchingEntries = [];
      
      var addMatch = function(ent) {
        var key = ent.sheetName + "_" + ent.rowIndex;
        if (!allMatchingEntriesMap[key]) {
          allMatchingEntriesMap[key] = true;
          allMatchingEntries.push(ent);
        }
      };
      
      matchingEntriesById.forEach(addMatch);
      matchingEntriesByEan.forEach(addMatch);
      
      if (allMatchingEntries.length > 0) {
        allMatchingEntries.forEach(function(entry) {
          var row = entry.row;
          var updateVal = function(idx, val) {
            if (idx !== -1 && val !== undefined && val !== null && val !== "") {
              row[idx] = val;
            }
          };
          updateVal(idIdx, newId);
          updateVal(eanIdx, newEan);
          updateVal(descIdx, newDesc);
          updateVal(stockIdx, newStock);
          updateVal(priceIdx, formatBrazilian(newPrice));
          updateVal(discIdx, formatBrazilian(newDiscount, true));
          updateVal(finalIdx, formatBrazilian(newFinal));
          updateVal(validIdx, newValid);
        });
        updatedCount++;
      } else {
        var industryName = targetIndustry;
        var prodSheet = sheetData["Produtos"];
        var headers = prodSheet ? prodSheet.headers : [];
        var rowLength = Math.max(headers.length, 8);
        var newRow = new Array(rowLength).fill("");
        
        newRow[idIdx] = newId;
        newRow[eanIdx] = newEan;
        newRow[descIdx] = newDesc;
        newRow[stockIdx] = newStock;
        newRow[priceIdx] = formatBrazilian(newPrice);
        newRow[discIdx] = formatBrazilian(newDiscount, true);
        newRow[finalIdx] = formatBrazilian(newFinal);
        newRow[validIdx] = newValid;
        
        var fabColIdx = -1;
        for (var h = 0; h < headers.length; h++) {
          if (normalizeStr(headers[h]).indexOf("fabricante") !== -1) {
            fabColIdx = h;
            break;
          }
        }
        if (fabColIdx !== -1) newRow[fabColIdx] = industryName;
        
        newProductsRows.push(newRow);
        newCount++;
        
        var newEntry = { row: newRow, sheetName: "Produtos" };
        if (newId) {
          if (!existingProductsMap[newId]) existingProductsMap[newId] = [];
          existingProductsMap[newId].push(newEntry);
        }
        if (newEan) {
          if (!existingProductsMap[newEan]) existingProductsMap[newEan] = [];
          existingProductsMap[newEan].push(newEntry);
        }
      }
    }
    
    log.push("Processamento concluído para " + industria + ".");
    log.push("Resumo: " + updatedCount + " produtos existentes foram atualizados.");
    log.push("Resumo: " + newCount + " novos produtos foram adicionados.");
    if (clearedProductIdsAndEans.length > 0) {
      log.push("Resumo: " + clearedProductIdsAndEans.length + " produtos desta indústria que não constavam na planilha atual foram limpos.");
    }
    
    log.push("Sincronizando alterações de volta com a planilha do Google...");
    
    // 3. Salvar de volta nas abas correspondentes
    Object.keys(sheetData).forEach(function(sName) {
      var sInfo = sheetData[sName];
      var finalRows = sInfo.rows;
      if (sName === "Produtos") {
        finalRows = finalRows.concat(newProductsRows);
      }
      
      var sheetObj = sInfo.sheetObj;
      sheetObj.clearContents();
      
      var range = sheetObj.getRange(1, 1, finalRows.length, finalRows[0].length);
      range.setValues(finalRows);
    });
    
    return { 
      sucesso: true, 
      industry: industria, 
      updatedCount: updatedCount, 
      newCount: newCount,
      log: log,
      hasNew: newCount > 0
    };
  } catch (error) {
    return { error: error.message || error.toString() };
  }
}

/**
 * Salva os itens do carrinho temporário de um cliente na aba ItensPedido
 */
function saveCart(spreadsheetId, clientId, items) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName("ItensPedido");
    if (!sheet) {
      return { error: "Aba 'ItensPedido' não encontrada." };
    }

    var values = sheet.getDataRange().getValues();
    var cartId = "CARRINHO_" + clientId;

    // Remove existing rows for this client's cart
    for (var i = values.length - 1; i >= 1; i--) {
      if (String(values[i][1] || "").trim() === cartId) {
        sheet.deleteRow(i + 1);
      }
    }

    // Append new cart rows
    if (items && items.length > 0) {
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        var quantity = Number(item.quantity) || 0;
        var price = Number(item.finalPrice) || 0;
        sheet.appendRow([
          cartId + "_" + item.id,       // IDItem
          cartId,                       // IDPedido
          String(item.id),              // IDProduto
          String(item.ean || ""),       // Codigo de Barras
          String(item.description || ""), // Descricao
          String(item.manufacturer || ""), // Fabricante
          quantity,                     // Qtd
          price,                        // Preco
          quantity * price              // Subtotal
        ]);
      }
    }

    // Dynamic handling of Carrinhos sheet overview
    var sheetCarrinhos = ss.getSheetByName("Carrinhos") || ss.getSheetByName("Carrinho") || ss.getSheetByName("carrinhos") || ss.getSheetByName("carrinho");
    if (!sheetCarrinhos) {
      try {
        sheetCarrinhos = ss.insertSheet("Carrinhos");
        sheetCarrinhos.appendRow(["IDCliente", "Cliente", "Data", "Itens", "Total"]);
      } catch (err) {
        console.warn("Could not insert Carrinhos sheet: " + err.toString());
      }
    }

    if (sheetCarrinhos) {
      var carrinhosValues = sheetCarrinhos.getDataRange().getValues();
      var foundRowIdx = -1;
      for (var r = 1; r < carrinhosValues.length; r++) {
        if (String(carrinhosValues[r][0] || "").trim() === String(clientId).trim()) {
          foundRowIdx = r + 1;
          break;
        }
      }

      var clientName = "Cliente " + clientId;
      var sheetClientes = ss.getSheetByName("Clientes");
      if (sheetClientes) {
        var clientesValues = sheetClientes.getDataRange().getValues();
        for (var k = 1; k < clientesValues.length; k++) {
          if (String(clientesValues[k][0] || "").trim() === String(clientId).trim()) {
            clientName = String(clientesValues[k][1] || clientesValues[k][2] || clientName).trim();
            break;
          }
        }
      }

      var total = 0;
      var itemsCount = 0;
      if (items && items.length > 0) {
        itemsCount = items.length;
        for (var j = 0; j < items.length; j++) {
          total += (Number(items[j].quantity) || 0) * (Number(items[j].finalPrice) || 0);
        }
      }

      var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-3", "dd/MM/yyyy HH:mm:ss");

      if (itemsCount === 0) {
        if (foundRowIdx !== -1) {
          sheetCarrinhos.deleteRow(foundRowIdx);
        }
      } else {
        var rowData = [
          String(clientId),
          clientName,
          nowStr,
          itemsCount,
          total
        ];

        if (foundRowIdx !== -1) {
          sheetCarrinhos.getRange(foundRowIdx, 1, 1, 5).setValues([rowData]);
        } else {
          sheetCarrinhos.appendRow(rowData);
        }
      }
    }

    return { sucesso: true };
  } catch (error) {
    return { error: error.message || error.toString() };
  }
}

/**
 * Recupera os itens do carrinho temporário de um cliente da aba ItensPedido
 */
function getCart(spreadsheetId, clientId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName("ItensPedido");
    if (!sheet) {
      return { error: "Aba 'ItensPedido' não encontrada." };
    }

    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return { data: [] };
    }

    var cartId = "CARRINHO_" + clientId;
    var items = [];

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (String(row[1] || "").trim() === cartId) {
        var quantity = Number(row[6]) || 0;
        var finalPrice = Number(row[7]) || 0;
        items.push({
          id: String(row[2] || ""),
          ean: String(row[3] || ""),
          description: String(row[4] || ""),
          manufacturer: String(row[5] || ""),
          quantity: quantity,
          finalPrice: finalPrice,
          stock: 999, // placeholder stock
          salePrice: finalPrice,
          discount: 0,
          category: "",
          photo: "",
          type: "normal"
        });
      }
    }

    return { data: items };
  } catch (error) {
    return { error: error.message || error.toString() };
  }
}
