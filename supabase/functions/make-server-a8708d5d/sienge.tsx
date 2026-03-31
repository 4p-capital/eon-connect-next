import { Hono } from "npm:hono@4";
import { createClient } from "npm:@supabase/supabase-js@2";

export const siengeRoutes = new Hono();

// 🔥 OTIMIZAÇÃO: Singleton lazy do Supabase client
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    console.log('✅ [sienge] Supabase client inicializado (lazy)');
  }
  return _supabase;
}

const BUCKET_TERMOS = 'make-a8708d5d-termos-assistencia';

// ═══════════════════════════════════════════════════════════════════
// 🏢 ROTA PARA ENVIAR TERMO PDF AO SIENGE (ERP)
// Fluxo: 1) Buscar cliente por CPF → 2) Buscar contratos → 3) Anexar PDF na unidade
// ═══════════════════════════════════════════════════════════════════

siengeRoutes.post("/assistencia-finalizada/:id/enviar-sienge", async (c) => {
  const supabase = getSupabase();
  const idFinalizacao = parseInt(c.req.param('id'));
  const SIENGE_BASE_URL = 'https://api.sienge.com.br/eoninc/public/api/v1';
  const SIENGE_AUTH = `Basic ${Deno.env.get('SIENGE_AUTH_TOKEN') || ''}`;

  console.log('═══════════════════════════════════════════════════════');
  console.log(`🏢 ENVIO AO SIENGE - Finalização #${idFinalizacao}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    // ─── 0) Validar token do Sienge ────────────────────────────────
    if (!Deno.env.get('SIENGE_AUTH_TOKEN')) {
      console.error('❌ SIENGE_AUTH_TOKEN não configurado');
      return c.json({ success: false, error: 'Token de autenticação do Sienge não configurado. Configure a variável SIENGE_AUTH_TOKEN.' }, 500);
    }

    // ─── 1) Buscar dados da finalização e assistência ──────────────
    console.log('📋 Etapa 1: Buscando dados da finalização...');
    const { data: finalizacao, error: errFin } = await supabase
      .from('assistencia_finalizada')
      .select('id, id_assistencia, status')
      .eq('id', idFinalizacao)
      .single();

    if (errFin || !finalizacao) {
      console.error('❌ Finalização não encontrada:', errFin);
      return c.json({ success: false, error: 'Registro de finalização não encontrado' }, 404);
    }

    console.log(`   ID Assistência: ${finalizacao.id_assistencia}`);

    // Buscar dados da assistência + JOIN com clientes via id_cliente
    const { data: assistenciaRaw, error: errAss } = await supabase
      .from('Assistência Técnica')
      .select('id, id_cliente, categoria_reparo, clientes!id_cliente(cpf, proprietario, bloco, unidade, empreendimento)')
      .eq('id', finalizacao.id_assistencia)
      .single();

    if (errAss || !assistenciaRaw) {
      console.error('❌ Assistência não encontrada:', errAss);
      return c.json({ success: false, error: 'Registro de assistência técnica não encontrado' }, 404);
    }

    // Flatten clientes data
    const clienteData = (assistenciaRaw as any).clientes || {};
    const assistencia = { ...assistenciaRaw, ...clienteData, clientes: undefined } as any;

    if (!assistencia.cpf) {
      console.error('❌ CPF não informado no cliente vinculado');
      return c.json({ success: false, error: 'CPF do cliente não está preenchido na tabela clientes' }, 400);
    }

    // Preparar variantes do CPF para busca
    const cpfOriginal = assistencia.cpf.trim();
    const cpfLimpo = cpfOriginal.replace(/\D/g, '');
    // Formatar CPF: 000.000.000-00
    const cpfFormatado = cpfLimpo.length === 11
      ? `${cpfLimpo.slice(0,3)}.${cpfLimpo.slice(3,6)}.${cpfLimpo.slice(6,9)}-${cpfLimpo.slice(9)}`
      : cpfOriginal;
    console.log(`   Proprietário: ${assistencia.proprietario}`);
    console.log(`   CPF original: ${cpfOriginal}`);
    console.log(`   CPF formatado: ${cpfFormatado}`);
    console.log(`   CPF limpo: ${cpfLimpo}`);

    // ─── 2) Buscar PDF do Storage ──────────────────────────────────
    console.log('📄 Etapa 2: Buscando PDF do Storage...');
    const { data: termoRecord, error: errTermo } = await supabase
      .from('termos_assistencia')
      .select('id, id_finalizacao, id_solicitacao, pdf_storage_path, pdf_bucket, enviado_sienge, data_envio_sienge, sienge_error')
      .eq('id_finalizacao', idFinalizacao)
      .maybeSingle();

    if (errTermo || !termoRecord || !termoRecord.pdf_storage_path) {
      console.error('❌ Termo/PDF não encontrado:', errTermo);
      return c.json({ success: false, error: 'PDF do termo não encontrado. Salve o termo antes de enviar ao Sienge.' }, 404);
    }

    const bucket = termoRecord.pdf_bucket || BUCKET_TERMOS;
    const { data: pdfData, error: errDownload } = await supabase.storage
      .from(bucket)
      .download(termoRecord.pdf_storage_path);

    if (errDownload || !pdfData) {
      console.error('❌ Erro ao baixar PDF do Storage:', errDownload);
      return c.json({ success: false, error: 'Erro ao baixar PDF do Storage: ' + (errDownload?.message || 'arquivo não encontrado') }, 500);
    }

    const pdfBuffer = new Uint8Array(await pdfData.arrayBuffer());
    const pdfFilename = termoRecord.pdf_storage_path.split('/').pop() || `termo-assistencia-${finalizacao.id_assistencia}.pdf`;
    console.log(`   ✅ PDF baixado: ${pdfFilename} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

    // ─── 3) SIENGE: Buscar cliente por CPF (tenta múltiplos formatos) ───
    console.log('🔍 Etapa 3: Buscando cliente no Sienge por CPF...');

    // Helper para buscar clientes no Sienge
    const buscarClienteSienge = async (cpfParam: string, label: string): Promise<any[] | null> => {
      const url = `${SIENGE_BASE_URL}/customers?cpf=${encodeURIComponent(cpfParam)}&limit=100&offset=0`;
      console.log(`   🔍 Tentativa (${label}): ${url}`);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'authorization': SIENGE_AUTH,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.log(`   ⚠️ Tentativa ${label} retornou HTTP ${res.status}: ${errText.substring(0, 200)}`);
        return null;
      }

      const data = await res.json();
      console.log(`   📊 Resposta completa da API (${label}):`, JSON.stringify(data).substring(0, 500));
      const results = data.results || data;
      const resultList = Array.isArray(results) ? results : [];
      console.log(`   📊 Tentativa ${label}: ${resultList.length} resultado(s)`);
      
      if (resultList.length > 0) {
        return resultList;
      }
      return null;
    };

    // Tentar com CPF formatado primeiro (000.000.000-00), depois apenas números, e por último o original
    let customers: any[] | null = null;
    let cpfUsado = '';

    // Tentativa 1: CPF formatado (000.000.000-00)
    customers = await buscarClienteSienge(cpfFormatado, 'formatado');
    if (customers) {
      cpfUsado = cpfFormatado;
    }

    // Tentativa 2: CPF apenas números
    if (!customers && cpfLimpo !== cpfFormatado) {
      customers = await buscarClienteSienge(cpfLimpo, 'apenas números');
      if (customers) {
        cpfUsado = cpfLimpo;
      }
    }

    // Tentativa 3: CPF original (como está no banco)
    if (!customers && cpfOriginal !== cpfFormatado && cpfOriginal !== cpfLimpo) {
      customers = await buscarClienteSienge(cpfOriginal, 'original');
      if (customers) {
        cpfUsado = cpfOriginal;
      }
    }

    if (!customers || customers.length === 0) {
      console.error('❌ Nenhum cliente encontrado em nenhuma tentativa de CPF:', { cpfFormatado, cpfLimpo, cpfOriginal });
      return c.json({
        success: false,
        error: `Nenhum cliente encontrado no Sienge com o CPF ${cpfOriginal}. Tentamos os formatos: "${cpfFormatado}", "${cpfLimpo}" e "${cpfOriginal}". Verifique se o CPF está cadastrado no ERP Sienge.`,
      }, 404);
    }

    const customerId = customers[0].id;
    console.log(`   ✅ Cliente encontrado (via ${cpfUsado}): ID=${customerId}, Nome=${customers[0].name || customers[0].nome || 'N/A'}`);

    // ─── 4) SIENGE: Buscar contratos de venda ──────────────────────
    console.log('📑 Etapa 4: Buscando contratos de venda no Sienge...');
    const urlContracts = `${SIENGE_BASE_URL}/sales-contracts?customerId=${customerId}`;
    console.log(`   URL: ${urlContracts}`);

    const resContracts = await fetch(urlContracts, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'authorization': SIENGE_AUTH,
      },
    });

    if (!resContracts.ok) {
      const errText = await resContracts.text();
      console.error(`❌ Sienge sales-contracts API erro ${resContracts.status}:`, errText);
      return c.json({
        success: false,
        error: `Erro ao buscar contratos no Sienge (HTTP ${resContracts.status})`,
        sienge_error: errText,
      }, 502);
    }

    const contractsData = await resContracts.json();
    const contracts = contractsData.results || contractsData;
    console.log(`   Contratos encontrados: ${Array.isArray(contracts) ? contracts.length : 0}`);

    if (!Array.isArray(contracts) || contracts.length === 0) {
      console.error('❌ Nenhum contrato encontrado para o cliente:', customerId);
      return c.json({
        success: false,
        error: `Nenhum contrato de venda encontrado no Sienge para o cliente ID ${customerId} (${assistencia.proprietario}).`,
      }, 404);
    }

    // Buscar o primeiro unitId disponível nos contratos
    let unitId: number | null = null;
    let contractInfo: any = null;
    for (const contract of contracts) {
      const units = contract.salesContractUnits || contract.units || [];
      if (Array.isArray(units) && units.length > 0) {
        unitId = units[0].id || units[0].unitId;
        contractInfo = contract;
        break;
      }
    }

    if (!unitId) {
      console.error('❌ Nenhuma unidade encontrada nos contratos');
      return c.json({
        success: false,
        error: 'Nenhuma unidade encontrada nos contratos de venda do Sienge. Verifique se o contrato possui unidades vinculadas.',
      }, 404);
    }

    console.log(`   ✅ Unidade encontrada: ID=${unitId}`);
    if (contractInfo) {
      console.log(`   Contrato: ID=${contractInfo.id}`);
    }

    // ─── 5) SIENGE: Enviar PDF como anexo da unidade ───────────────
    console.log('📤 Etapa 5: Enviando PDF como anexo da unidade no Sienge...');
    const description = `Termo Assistência Técnica - ${assistencia.proprietario} - ${assistencia.empreendimento} ${assistencia.bloco}-${assistencia.unidade}`;
    const urlAttachment = `${SIENGE_BASE_URL}/units/${unitId}/attachments?description=${encodeURIComponent(description)}`;
    console.log(`   URL: ${urlAttachment}`);
    console.log(`   Descrição: ${description}`);
    console.log(`   Arquivo: ${pdfFilename} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

    // Construir multipart/form-data manualmente
    const boundary = `----SiengeUpload${Date.now()}`;
    const CRLF = '\r\n';
    
    const headerPart = `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${pdfFilename}"${CRLF}Content-Type: application/pdf${CRLF}${CRLF}`;
    const footerPart = `${CRLF}--${boundary}--${CRLF}`;
    
    const headerBytes = new TextEncoder().encode(headerPart);
    const footerBytes = new TextEncoder().encode(footerPart);
    
    const bodyBuffer = new Uint8Array(headerBytes.length + pdfBuffer.length + footerBytes.length);
    bodyBuffer.set(headerBytes, 0);
    bodyBuffer.set(pdfBuffer, headerBytes.length);
    bodyBuffer.set(footerBytes, headerBytes.length + pdfBuffer.length);

    const resAttachment = await fetch(urlAttachment, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': SIENGE_AUTH,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    const attachmentStatus = resAttachment.status;
    let attachmentResponseText = '';
    try {
      attachmentResponseText = await resAttachment.text();
    } catch {
      attachmentResponseText = '';
    }
    
    let attachmentResponse: any = null;
    try {
      attachmentResponse = JSON.parse(attachmentResponseText);
    } catch {
      attachmentResponse = { raw: attachmentResponseText || 'Sem resposta' };
    }

    console.log(`   Sienge Response Status: ${attachmentStatus}`);
    console.log(`   Sienge Response:`, JSON.stringify(attachmentResponse));

    if (!resAttachment.ok) {
      console.error(`❌ Erro ao enviar anexo ao Sienge (HTTP ${attachmentStatus}):`, attachmentResponse);
      
      // Registrar erro no banco
      await supabase
        .from('termos_assistencia')
        .update({
          sienge_error: JSON.stringify({ status: attachmentStatus, response: attachmentResponse }),
        })
        .eq('id', termoRecord.id);

      return c.json({
        success: false,
        error: `Erro ao enviar anexo ao Sienge (HTTP ${attachmentStatus})`,
        sienge_status: attachmentStatus,
        sienge_error: attachmentResponse,
      }, 502);
    }

    console.log('✅ PDF enviado ao Sienge com sucesso!');

    // ─── 6) Atualizar banco de dados ───────────────────────────────
    console.log('💾 Etapa 6: Atualizando registros no banco...');

    // 6a) Atualizar termos_assistencia
    const { error: errUpdateTermo } = await supabase
      .from('termos_assistencia')
      .update({
        enviado_sienge: true,
        data_envio_sienge: new Date().toISOString(),
        sienge_response: JSON.stringify({
          status: attachmentStatus,
          response: attachmentResponse,
          customerId,
          unitId,
          contractId: contractInfo?.id,
        }),
        sienge_error: null,
      })
      .eq('id', termoRecord.id);

    if (errUpdateTermo) {
      console.error('⚠️ Erro ao atualizar termos_assistencia:', errUpdateTermo);
    } else {
      console.log('   ✅ termos_assistencia atualizado');
    }

    // 6b) Atualizar status em assistencia_finalizada para "Finalizado"
    const { error: errUpdateFin } = await supabase
      .from('assistencia_finalizada')
      .update({ status: 'Finalizado' })
      .eq('id', idFinalizacao);

    if (errUpdateFin) {
      console.error('⚠️ Erro ao atualizar assistencia_finalizada:', errUpdateFin);
    } else {
      console.log('   ✅ assistencia_finalizada → status "Finalizado"');
    }

    // 6c) Atualizar status em Assistência Técnica para "Finalizado"
    const { error: errUpdateAss } = await supabase
      .from('Assistência Técnica')
      .update({ status_chamado: 'Finalizado' })
      .eq('id', finalizacao.id_assistencia);

    if (errUpdateAss) {
      console.error('⚠️ Erro ao atualizar Assistência Técnica:', errUpdateAss);
    } else {
      console.log('   ✅ Assistência Técnica → status_chamado "Finalizado"');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 ENVIO AO SIENGE CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════');

    return c.json({
      success: true,
      message: 'Termo enviado ao Sienge com sucesso! Status atualizado para Finalizado.',
      data: {
        customerId,
        unitId,
        contractId: contractInfo?.id,
        sienge_status: attachmentStatus,
        enviado_em: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Erro geral ao enviar ao Sienge:', error);
    
    // Tentar registrar erro no banco
    try {
      await getSupabase()
        .from('termos_assistencia')
        .update({
          sienge_error: JSON.stringify({ error: String(error), stack: error instanceof Error ? error.stack : undefined }),
        })
        .eq('id_finalizacao', idFinalizacao);
    } catch {}

    return c.json({
      success: false,
      error: 'Erro ao enviar termo ao Sienge: ' + (error instanceof Error ? error.message : String(error)),
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🔧 ROTA PARA FINALIZAR MANUALMENTE (quando Sienge falha)
// Atualiza status para "Finalizado" sem sincronizar com Sienge
// ═══════════════════════════════════════════════════════════════════

siengeRoutes.post("/assistencia-finalizada/:id/finalizar-manual", async (c) => {
  const supabase = getSupabase();
  const idFinalizacao = parseInt(c.req.param('id'));

  console.log('═══════════════════════════════════════════════════════');
  console.log('🔧 FINALIZAÇÃO MANUAL (sem Sienge)');
  console.log(`   ID Finalização: ${idFinalizacao}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    // 1) Buscar registro de finalização (select específico, sem foto_reparo base64)
    const { data: finalizacao, error: errFin } = await supabase
      .from('assistencia_finalizada')
      .select('id, id_assistencia, status')
      .eq('id', idFinalizacao)
      .single();

    if (errFin || !finalizacao) {
      console.error('❌ Finalização não encontrada:', errFin);
      return c.json({ success: false, error: 'Registro de finalização não encontrado' }, 404);
    }

    // Verificar se já está finalizado
    if (finalizacao.status === 'Finalizado') {
      console.log('⚠️ Já está finalizado');
      return c.json({ success: true, message: 'Chamado já está finalizado', already_finalized: true });
    }

    // 2) Atualizar assistencia_finalizada → status "Finalizado"
    const { error: errUpdateFin } = await supabase
      .from('assistencia_finalizada')
      .update({ status: 'Finalizado' })
      .eq('id', idFinalizacao);

    if (errUpdateFin) {
      console.error('❌ Erro ao atualizar assistencia_finalizada:', errUpdateFin);
      return c.json({ success: false, error: 'Erro ao atualizar status da finalização: ' + errUpdateFin.message }, 500);
    }
    console.log('   ✅ assistencia_finalizada → status "Finalizado"');

    // 3) Atualizar Assistência Técnica → status_chamado "Finalizado"
    if (finalizacao.id_assistencia) {
      const { error: errUpdateAss } = await supabase
        .from('Assistência Técnica')
        .update({ status_chamado: 'Finalizado' })
        .eq('id', finalizacao.id_assistencia);

      if (errUpdateAss) {
        console.error('⚠️ Erro ao atualizar Assistência Técnica:', errUpdateAss);
      } else {
        console.log('   ✅ Assistência Técnica → status_chamado "Finalizado"');
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 FINALIZAÇÃO MANUAL CONCLUÍDA COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════');

    return c.json({
      success: true,
      message: 'Chamado finalizado manualmente com sucesso (sem sincronização Sienge).',
    });

  } catch (error) {
    console.error('❌ Erro geral na finalização manual:', error);
    return c.json({
      success: false,
      error: 'Erro ao finalizar manualmente: ' + (error instanceof Error ? error.message : String(error)),
    }, 500);
  }
});

console.log('📦 [sienge] Módulo carregado (enviar-sienge + finalizar-manual)');
