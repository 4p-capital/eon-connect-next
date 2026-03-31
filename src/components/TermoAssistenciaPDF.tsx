"use client";

import jsPDF from 'jspdf';

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE PDF - SOLICITAÇÃO DE ASSISTÊNCIA TÉCNICA
// Layout idêntico ao TermoAssistenciaViewer.tsx (HTML limpo)
// Sem ícones, sem logo, apenas bolinhas numeradas e textos
// Gerado com jsPDF (compatível com esm.sh)
// ═══════════════════════════════════════════════════════════════════

export interface TermoDados {
  id: number | string;
  id_finalizacao?: number;
  id_assistencia_original?: number;
  proprietario: string;
  cpf: string;
  email: string;
  telefone: string;
  bloco: string;
  unidade: string;
  empreendimento: string;
  descricao_cliente: string;
  categoria_reparo: string;
  url_foto?: string | null;
  created_at: string;
  data_vistoria: string | null;
  data_reparo: string | null;
  empresa_nome: string | null;
  responsaveis?: string[];
  providencias?: string;
  nps?: number | null;
  created_at_finalizacao?: string;
  assinaturaVencida?: boolean;
  nome_representante?: string;
  cpf_representante?: string;
  grau_afinidade?: string;
  foto_reparo_base64?: string;
}

// -- Helpers -------------------------------------------------------

const formatarDataCurta = (dataStr: string | null | undefined): string => {
  if (!dataStr) return '---';
  try {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dataStr;
  }
};

const formatarDataHoraPDF = (dataStr: string | null | undefined): string => {
  if (!dataStr) return '---';
  try {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dataStr;
  }
};

// Cores (espelhando o viewer)
const COR_AZUL = { r: 70, g: 90, b: 140 };
const COR_TEXTO = { r: 75, g: 85, b: 99 };        // gray-600
const COR_TEXTO_LABEL = { r: 107, g: 114, b: 128 }; // gray-500
const COR_SEPARADOR = { r: 209, g: 213, b: 219 };   // gray-300
const COR_FOOTER = { r: 156, g: 163, b: 175 };       // gray-400
const COR_VERMELHO = { r: 220, g: 38, b: 38 };       // red-600
const COR_VERMELHO_CLARO = { r: 239, g: 68, b: 68 }; // red-500

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  return doc.splitTextToSize(text, maxWidth) as string[];
}

// -- Bolinha numerada (idêntica ao viewer) -------------------------
function drawSectionNumber(doc: jsPDF, num: number, x: number, y: number) {
  doc.setFillColor(COR_AZUL.r, COR_AZUL.g, COR_AZUL.b);
  doc.circle(x + 3.5, y - 1.5, 3.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(String(num), x + 3.5, y - 0.5, { align: 'center' });
}

// -- Separador (linha cinza fina) ---------------------------------
function drawSeparator(doc: jsPDF, y: number, left: number, right: number) {
  doc.setDrawColor(COR_SEPARADOR.r, COR_SEPARADOR.g, COR_SEPARADOR.b);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
}

// -- Label: valor (bold label + normal value) ---------------------
function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  fontSize = 8
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(label, x, y);
  const labelW = doc.getTextWidth(label);
  doc.setFont('helvetica', 'normal');
  doc.text(` ${value}`, x + labelW, y);
}

// ═════════════════════════════════════════════════════════════════
// GERADOR PRINCIPAL
// ═════════════════════════════════════════════════════════════════

export function gerarTermoPDF(dados: TermoDados): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const mL = 20; // margem esquerda
  const mR = 20; // margem direita
  const contentW = pageWidth - mL - mR;
  const rightEdge = pageWidth - mR;

  const idChamado = dados.id_assistencia_original || dados.id;
  const idFinalizado = dados.id_finalizacao || '---';

  let y = 0;

  // Helper: checar se precisa nova pagina
  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      doc.addPage();
      y = 20;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // PÁGINA 1
  // ═══════════════════════════════════════════════════════════════

  y = 18;

  // -- Números de referência (topo) --
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COR_TEXTO_LABEL.r, COR_TEXTO_LABEL.g, COR_TEXTO_LABEL.b);
  doc.text(`N\u00ba SOLICITA\u00c7\u00c3O: `, mL, y);
  const solW = doc.getTextWidth(`N\u00ba SOLICITA\u00c7\u00c3O: `);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(String(idChamado), mL + solW, y);

  y += 4.5;
  doc.setTextColor(COR_TEXTO_LABEL.r, COR_TEXTO_LABEL.g, COR_TEXTO_LABEL.b);
  doc.text(`N\u00ba FINALIZA\u00c7\u00c3O: `, mL, y);
  const finW = doc.getTextWidth(`N\u00ba FINALIZA\u00c7\u00c3O: `);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(String(idFinalizado), mL + finW, y);

  // -- Título centralizado (azul) --
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(COR_AZUL.r, COR_AZUL.g, COR_AZUL.b);
  doc.text('SOLICITA\u00c7\u00c3O DE ASSIST\u00caNCIA T\u00c9CNICA', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // ═══ DADOS DO IMÓVEL ═══
  drawSeparator(doc, y, mL, rightEdge);
  y += 7;

  const dataX = mL + 2;
  drawLabelValue(doc, 'EMPREENDIMENTO:', dados.empreendimento || '---', dataX, y);
  y += 5.5;

  drawLabelValue(doc, 'BLOCO:', dados.bloco || '---', dataX, y);
  const blocoEnd = dataX + doc.getTextWidth('BLOCO:') + doc.getTextWidth(` ${dados.bloco || '---'}`) + 12;
  drawLabelValue(doc, 'APARTAMENTO:', dados.unidade || '---', blocoEnd, y);
  y += 5.5;

  drawLabelValue(doc, 'SOLICITADO EM:', formatarDataHoraPDF(dados.created_at), dataX, y);
  y += 5.5;

  drawLabelValue(doc, 'DATA DA VISTORIA:', formatarDataCurta(dados.data_vistoria), dataX, y);
  y += 5.5;

  drawLabelValue(doc, 'DATA DO REPARO:', formatarDataCurta(dados.data_reparo), dataX, y);
  y += 6;

  // ═══ DADOS DO MORADOR ═══
  drawSeparator(doc, y, mL, rightEdge);
  y += 7;

  drawLabelValue(doc, 'MORADOR:', dados.proprietario || '---', dataX, y);
  y += 5.5;

  drawLabelValue(doc, 'CPF:', dados.cpf || '---', dataX, y);
  y += 5.5;

  drawLabelValue(doc, 'TELEFONE:', dados.telefone || '---', dataX, y);
  y += 6;

  drawSeparator(doc, y, mL, rightEdge);
  y += 12;

  // ═══ 1. DESCRIÇÃO DO PROBLEMA ═══
  checkPage(40);
  drawSectionNumber(doc, 1, mL, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text('DESCRI\u00c7\u00c3O DO PROBLEMA', mL + 10, y);
  y += 7;

  // Sub-linha bloco / apartamento
  drawLabelValue(doc, 'BLOCO:', dados.bloco || '---', dataX, y);
  const blocoEnd2 = dataX + doc.getTextWidth('BLOCO:') + doc.getTextWidth(` ${dados.bloco || '---'}`) + 8;
  drawLabelValue(doc, 'APARTAMENTO:', dados.unidade || '---', blocoEnd2, y);
  y += 5;

  // Texto da descrição
  const descLines = wrapText(doc, dados.descricao_cliente || 'Sem descri\u00e7\u00e3o informada.', contentW - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(descLines, dataX, y);
  y += descLines.length * 4 + 8;

  // ═══ 2. TÉC. RESPONSÁVEL ═══
  checkPage(20);
  drawSectionNumber(doc, 2, mL, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text('T\u00c9C. RESPONS\u00c1VEL PELA ASSIST\u00caNCIA T\u00c9CNICA', mL + 10, y);
  y += 7;

  const tecNome =
    dados.responsaveis && dados.responsaveis.length > 0
      ? dados.responsaveis.join(', ')
      : '---';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(tecNome, dataX, y);

  // NOTA no lado direito
  const npsStr = `NOTA: ${dados.nps != null ? String(dados.nps) : '---'}`;
  doc.setFont('helvetica', 'bold');
  doc.text(npsStr, rightEdge, y, { align: 'right' });
  y += 10;

  // ═══ 3. PROVIDÊNCIAS ═══
  checkPage(25);
  drawSectionNumber(doc, 3, mL, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text('PROVID\u00caNCIAS', mL + 10, y);
  y += 7;

  const provText = dados.providencias || 'Sem provid\u00eancias registradas.';
  const provLines = wrapText(doc, provText, contentW - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(provLines, dataX, y);
  y += provLines.length * 4 + 6;

  // ═══ 4. REGISTRO FOTOGRÁFICO DO REPARO ═══
  if (dados.foto_reparo_base64) {
    checkPage(70);
    drawSectionNumber(doc, 4, mL, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
    doc.text('REGISTRO FOTOGR\u00c1FICO DO REPARO', mL + 10, y);
    y += 7;

    try {
      const imgFormat = dados.foto_reparo_base64.startsWith('/9j/') ? 'JPEG' : 'PNG';
      const maxImgW = contentW - 10;
      const maxImgH = 80;

      // Calcular dimensões proporcionais usando propriedades internas do jsPDF
      const imgProps = doc.getImageProperties(`data:image/${imgFormat.toLowerCase()};base64,${dados.foto_reparo_base64}`);
      let imgW = maxImgW;
      let imgH = (imgProps.height / imgProps.width) * imgW;
      if (imgH > maxImgH) {
        imgH = maxImgH;
        imgW = (imgProps.width / imgProps.height) * imgH;
      }

      checkPage(imgH + 12);

      // Borda ao redor da imagem
      doc.setDrawColor(COR_SEPARADOR.r, COR_SEPARADOR.g, COR_SEPARADOR.b);
      doc.setLineWidth(0.3);
      doc.roundedRect(dataX, y, imgW + 4, imgH + 4, 1, 1, 'D');

      doc.addImage(
        `data:image/${imgFormat.toLowerCase()};base64,${dados.foto_reparo_base64}`,
        imgFormat,
        dataX + 2,
        y + 2,
        imgW,
        imgH
      );
      y += imgH + 12;
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(COR_TEXTO_LABEL.r, COR_TEXTO_LABEL.g, COR_TEXTO_LABEL.b);
      doc.text('Foto do reparo n\u00e3o dispon\u00edvel', dataX, y);
      y += 8;
    }
  }

  // ═══ BADGE ASSINATURA VENCIDA ═══
  if (dados.assinaturaVencida) {
    checkPage(18);
    y += 4;

    // Fundo rosa claro com borda
    const badgeH = 12;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.setLineWidth(0.3);
    doc.roundedRect(mL, y, contentW, badgeH, 2, 2, 'FD');

    // Linha 1
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(COR_VERMELHO.r, COR_VERMELHO.g, COR_VERMELHO.b);
    doc.text('FINALIZADO \u2014 ASSINATURA VENCIDA (prazo de 7 dias expirado)', mL + 5, y + 4.5);

    // Linha 2
    doc.setFontSize(6);
    doc.setTextColor(COR_VERMELHO_CLARO.r, COR_VERMELHO_CLARO.g, COR_VERMELHO_CLARO.b);
    doc.text('Aceite por decurso de prazo \u2014 aceita\u00e7\u00e3o t\u00e1cita', mL + 5, y + 9);

    y += badgeH + 6;
  }

  // ═══════════════════════════════════════════════════════════════
  // PÁGINA 2 - TERMO DE RECEBIMENTO
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 18;

  // -- Números de referência (repetidos) --
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COR_TEXTO_LABEL.r, COR_TEXTO_LABEL.g, COR_TEXTO_LABEL.b);
  doc.text(`N\u00ba SOLICITA\u00c7\u00c3O: `, mL, y);
  const solW2 = doc.getTextWidth(`N\u00ba SOLICITA\u00c7\u00c3O: `);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(String(idChamado), mL + solW2, y);

  y += 4.5;
  doc.setTextColor(COR_TEXTO_LABEL.r, COR_TEXTO_LABEL.g, COR_TEXTO_LABEL.b);
  doc.text(`N\u00ba FINALIZA\u00c7\u00c3O: `, mL, y);
  const finW2 = doc.getTextWidth(`N\u00ba FINALIZA\u00c7\u00c3O: `);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(String(idFinalizado), mL + finW2, y);

  // -- Título --
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(COR_AZUL.r, COR_AZUL.g, COR_AZUL.b);
  doc.text('SOLICITA\u00c7\u00c3O DE ASSIST\u00caNCIA T\u00c9CNICA', pageWidth / 2, y, { align: 'center' });
  y += 16;

  // ═══ BOX: TERMO DE RECEBIMENTO ═══
  const termoBoxX = mL;
  const termoBoxW = contentW;

  // Header do box
  doc.setDrawColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.setLineWidth(0.4);
  doc.rect(termoBoxX, y, termoBoxW, 8, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text('Termo de Recebimento dos Servi\u00e7os de Assist\u00eancia T\u00e9cnica', termoBoxX + 4, y + 5.5);

  // Corpo do box
  const termoCorpoY = y + 8;
  doc.rect(termoBoxX, termoCorpoY, termoBoxW, 14, 'D');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  const termoTexto = 'Pelo presente termo, aceito os servi\u00e7os prestados para corre\u00e7\u00e3o das falhas apontadas acima, nada mais tendo a reclamar sobre os mesmos';
  const termoLines = wrapText(doc, termoTexto, termoBoxW - 8);
  doc.text(termoLines, termoBoxX + 4, termoCorpoY + 5);

  y = termoCorpoY + 22;

  // -- Local e data --
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  const dateStr = '(GO),_______ de';
  doc.text(dateStr, pageWidth / 2 - 30, y);
  doc.line(pageWidth / 2 - 10, y + 0.5, pageWidth / 2 + 20, y + 0.5);
  doc.text('de', pageWidth / 2 + 22, y);
  doc.line(pageWidth / 2 + 27, y + 0.5, pageWidth / 2 + 42, y + 0.5);
  doc.text('.', pageWidth / 2 + 43, y);

  y += 18;

  // -- Área de assinatura --
  const sigCenterX = pageWidth / 2;
  const sigLineW = 70;

  // Salvar posição da linha de assinatura para o carimbo
  const sigLineY = y;

  doc.setDrawColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.setLineWidth(0.4);
  doc.line(sigCenterX - sigLineW / 2, y, sigCenterX + sigLineW / 2, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text('Assinatura do Propriet\u00e1rio/Representante', sigCenterX, y, { align: 'center' });
  y += 4;

  // ═══ CARIMBO — ASSINATURA VENCIDA / ACEITAÇÃO TÁCITA ═══
  if (dados.assinaturaVencida) {
    const stampCenterX = sigCenterX;
    const stampCenterY = sigLineY - 4;

    // Dimensões do carimbo
    const stampW = 62;
    const stampH = 18;

    const sX = stampCenterX - stampW / 2;
    const sY = stampCenterY - stampH / 2;

    // Borda externa
    doc.setDrawColor(185, 28, 28);
    doc.setLineWidth(0.8);
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(sX, sY, stampW, stampH, 1.5, 1.5, 'FD');

    // Borda interna (efeito "double border")
    doc.setLineWidth(0.3);
    doc.roundedRect(sX + 1.5, sY + 1.5, stampW - 3, stampH - 3, 1, 1, 'D');

    // Texto principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(185, 28, 28);
    doc.text('ASSINATURA VENCIDA', stampCenterX, stampCenterY - 1, { align: 'center' });

    // Subtexto
    doc.setFontSize(6.5);
    doc.text('ACEITA\u00c7\u00c3O T\u00c1CITA', stampCenterX, stampCenterY + 4.5, { align: 'center' });
  }

  y += 10;

  // ═══ DADOS DO REPRESENTANTE ═══
  const repLabelX = mL + 4;
  const repLineStartX = mL + 48;
  const repLineEndX = rightEdge - 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);

  // Nome Representante
  doc.text('Nome Representante:', repLabelX, y);
  doc.setDrawColor(COR_SEPARADOR.r, COR_SEPARADOR.g, COR_SEPARADOR.b);
  doc.setLineWidth(0.3);
  doc.line(repLineStartX, y + 0.5, repLineEndX, y + 0.5);
  if (dados.nome_representante) {
    doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
    doc.text(dados.nome_representante, repLineStartX + 2, y);
  }
  y += 8;

  // CPF Representante
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text('CPF Representante:', repLabelX, y);
  doc.line(repLineStartX, y + 0.5, repLineEndX, y + 0.5);
  if (dados.cpf_representante) {
    doc.text(dados.cpf_representante, repLineStartX + 2, y);
  }
  y += 8;

  // Grau de afinidade
  doc.text('Grau de afinidade:', repLabelX, y);
  doc.line(repLineStartX, y + 0.5, repLineEndX, y + 0.5);
  if (dados.grau_afinidade) {
    doc.text(dados.grau_afinidade, repLineStartX + 2, y);
  }

  // ═══════════════════════════════════════════════════════════════
  // PÁGINA 3 - TERMO DE ASSISTÊNCIA TÉCNICA (texto legal)
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 18;

  // -- Números de referência (repetidos) --
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COR_TEXTO_LABEL.r, COR_TEXTO_LABEL.g, COR_TEXTO_LABEL.b);
  doc.text(`N\u00ba SOLICITA\u00c7\u00c3O: `, mL, y);
  const solW3 = doc.getTextWidth(`N\u00ba SOLICITA\u00c7\u00c3O: `);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(String(idChamado), mL + solW3, y);

  y += 4.5;
  doc.setTextColor(COR_TEXTO_LABEL.r, COR_TEXTO_LABEL.g, COR_TEXTO_LABEL.b);
  doc.text(`N\u00ba FINALIZA\u00c7\u00c3O: `, mL, y);
  const finW3 = doc.getTextWidth(`N\u00ba FINALIZA\u00c7\u00c3O: `);
  doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
  doc.text(String(idFinalizado), mL + finW3, y);

  // -- Título centralizado (azul) --
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(COR_AZUL.r, COR_AZUL.g, COR_AZUL.b);
  doc.text('TERMO DE ASSIST\u00caNCIA T\u00c9CNICA', pageWidth / 2, y, { align: 'center' });
  y += 10;

  drawSeparator(doc, y, mL, rightEdge);
  y += 8;

  // Helper para renderizar parágrafos do termo legal com quebra de página automática
  const renderParagrafo = (texto: string, indent: boolean = false) => {
    const xPos = indent ? dataX + 2 : dataX;
    const wrapWidth = indent ? contentW - 8 : contentW - 4;
    const lines = wrapText(doc, texto, wrapWidth);
    
    for (let i = 0; i < lines.length; i++) {
      if (y > 272) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(COR_TEXTO.r, COR_TEXTO.g, COR_TEXTO.b);
      doc.text(lines[i], xPos, y);
      y += 4;
    }
    y += 3;
  };

  renderParagrafo('Declaro que estou ciente de que, ao solicitar a assist\u00eancia t\u00e9cnica por meio do sistema digital, autorizo a realiza\u00e7\u00e3o de vistoria, diagn\u00f3stico e, quando aplic\u00e1vel, reparo na minha unidade, conforme a solicita\u00e7\u00e3o registrada.');

  renderParagrafo('Estou ciente de que, ap\u00f3s a realiza\u00e7\u00e3o da vistoria t\u00e9cnica, ser\u00e1 disponibilizado o termo t\u00e9cnico, contendo a descri\u00e7\u00e3o das constata\u00e7\u00f5es realizadas e o enquadramento da solicita\u00e7\u00e3o como procedente ou improcedente, conforme an\u00e1lise t\u00e9cnica.');

  renderParagrafo('Nos casos em que a solicita\u00e7\u00e3o for considerada PROCEDENTE, ap\u00f3s a conclus\u00e3o do reparo ser\u00e1 disponibilizado o termo t\u00e9cnico de reparo realizado, contendo a descri\u00e7\u00e3o dos servi\u00e7os executados, sendo concedido o prazo de 07 (sete) dias corridos, contados a partir da conclus\u00e3o do servi\u00e7o, para an\u00e1lise, assinatura ou apresenta\u00e7\u00e3o de eventual contesta\u00e7\u00e3o, exclusivamente pelos canais oficiais de atendimento.');

  renderParagrafo('Declaro, ainda, que a n\u00e3o assinatura do termo e a aus\u00eancia de qualquer manifesta\u00e7\u00e3o ou contesta\u00e7\u00e3o dentro do prazo de 07 (sete) dias corridos ser\u00e3o consideradas, para todos os fins, como aceita\u00e7\u00e3o t\u00e1cita, plena e irrevog\u00e1vel do reparo realizado ou do parecer t\u00e9cnico emitido, reconhecendo que o servi\u00e7o foi executado de forma adequada e conforme a solicita\u00e7\u00e3o inicial.');

  renderParagrafo('Nos casos em que a solicita\u00e7\u00e3o for considerada IMPROCEDENTE, fica consignado que o item analisado n\u00e3o apresenta v\u00edcio construtivo, n\u00e3o se enquadra nas condi\u00e7\u00f5es de garantia previstas no Manual do Propriet\u00e1rio e/ou decorre de uso inadequado, falta de manuten\u00e7\u00e3o, desgaste natural ou interven\u00e7\u00e3o de terceiros, n\u00e3o sendo devido qualquer reparo por parte da construtora. Nessa hip\u00f3tese, ser\u00e1 concedido igualmente o prazo de 07 (sete) dias corridos, contados a partir da comunica\u00e7\u00e3o do resultado da vistoria, para eventual manifesta\u00e7\u00e3o ou contesta\u00e7\u00e3o pelos canais oficiais.');

  renderParagrafo('Estou ciente de que, decorrido o referido prazo sem manifesta\u00e7\u00e3o, o chamado ser\u00e1 automaticamente encerrado, independentemente da minha assinatura, n\u00e3o sendo admitidas contesta\u00e7\u00f5es posteriores relacionadas \u00e0 mesma solicita\u00e7\u00e3o, ressalvadas apenas as hip\u00f3teses legalmente previstas.');

  renderParagrafo('Reconhe\u00e7o que eventual nova reclama\u00e7\u00e3o, solicita\u00e7\u00e3o ou problema, ainda que relacionado \u00e0 mesma unidade ou item analisado, dever\u00e1 ser realizada por meio da abertura de novo chamado de assist\u00eancia t\u00e9cnica, sujeitando-se \u00e0s regras, prazos e condi\u00e7\u00f5es vigentes \u00e0 \u00e9poca da nova solicita\u00e7\u00e3o.');

  renderParagrafo('Declaro, por fim, que as comunica\u00e7\u00f5es eletr\u00f4nicas encaminhadas pelos meios cadastrados s\u00e3o v\u00e1lidas para fins de ci\u00eancia da conclus\u00e3o do reparo ou do resultado da vistoria, in\u00edcio da contagem dos prazos acima mencionados e encerramento do chamado, e que o presente termo possui validade jur\u00eddica, inclusive independentemente de assinatura f\u00edsica, a partir da minha concord\u00e2ncia eletr\u00f4nica no momento da solicita\u00e7\u00e3o do servi\u00e7o.');

  // ═══ FOOTER (todas as páginas) ═══
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Linha fina
    doc.setDrawColor(COR_SEPARADOR.r, COR_SEPARADOR.g, COR_SEPARADOR.b);
    doc.setLineWidth(0.15);
    doc.line(mL, 285, rightEdge, 285);
    // Texto esquerdo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(COR_FOOTER.r, COR_FOOTER.g, COR_FOOTER.b);
    doc.text('EON Connect \u2014 Sistema de Gest\u00e3o de Assist\u00eancia T\u00e9cnica', mL, 289);
    // Texto direito
    doc.text(
      `Protocolo #${String(idChamado)}  \u2022  P\u00e1gina ${i}/${totalPages}`,
      rightEdge,
      289,
      { align: 'right' }
    );
  }

  return doc;
}

// -- Helper: carregar imagem de URL para base64 -----------------

export async function carregarImagemBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove o prefixo "data:image/...;base64,"
        resolve(result.split(',')[1] || null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// -- Funções de conveniência ------------------------------------

export function gerarTermoBlob(dados: TermoDados): Blob {
  const doc = gerarTermoPDF(dados);
  return doc.output('blob');
}

export function gerarTermoBlobUrl(dados: TermoDados): string {
  const blob = gerarTermoBlob(dados);
  return URL.createObjectURL(blob);
}

/** Gera o blob do PDF carregando a foto do reparo automaticamente */
export async function gerarTermoBlobComFoto(dados: TermoDados): Promise<Blob> {
  if (dados.url_foto && !dados.foto_reparo_base64) {
    dados.foto_reparo_base64 = (await carregarImagemBase64(dados.url_foto)) ?? undefined;
  }
  return gerarTermoBlob(dados);
}