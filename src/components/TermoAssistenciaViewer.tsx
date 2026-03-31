"use client";

import type { TermoDados } from '@/components/TermoAssistenciaPDF';

// ═══════════════════════════════════════════════════════════════════
// VIEWER HTML - SOLICITAÇÃO DE ASSISTÊNCIA TÉCNICA
// Renderiza o termo como HTML limpo (estilo Word/documento)
// ═══════════════════════════════════════════════════════════════════

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

const formatarDataHora = (dataStr: string | null | undefined): string => {
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

function SectionNumber({ num }: { num: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: 'rgb(70, 90, 140)' }}
    >
      {num}
    </span>
  );
}

function Separator() {
  return <div className="border-t border-gray-300 my-1" />;
}

interface TermoAssistenciaViewerProps {
  dados: TermoDados;
}

export function TermoAssistenciaViewer({ dados }: TermoAssistenciaViewerProps) {
  const idChamado = dados.id_assistencia_original || dados.id;
  const idFinalizado = dados.id_finalizacao || '---';
  const tecNome =
    dados.responsaveis && dados.responsaveis.length > 0
      ? dados.responsaveis.join(', ')
      : '---';
  const npsText = dados.nps != null ? String(dados.nps) : '---';
  const provText = dados.providencias || 'Sem providências registradas.';

  return (
    <div className="bg-white">
      {/* ═══ PÁGINA 1 ═══ */}
      <div className="px-8 pt-6 pb-10">
        {/* Números de referência */}
        <div className="mb-6">
          <p className="text-[11px] font-bold text-gray-500 leading-relaxed tracking-wide">
            N° SOLICITAÇÃO: <span className="text-gray-700">{String(idChamado)}</span>
          </p>
          <p className="text-[11px] font-bold text-gray-500 leading-relaxed tracking-wide">
            N° FINALIZAÇÃO: <span className="text-gray-700">{String(idFinalizado)}</span>
          </p>
        </div>

        {/* Título */}
        <h1
          className="text-center text-lg font-bold mb-8 tracking-wide"
          style={{ color: 'rgb(70, 90, 140)' }}
        >
          SOLICITAÇÃO DE ASSISTÊNCIA TÉCNICA
        </h1>

        {/* ═══ DADOS DO IMÓVEL ═══ */}
        <Separator />
        <div className="py-4 space-y-2.5 pl-2">
          <p className="text-[13px] text-gray-600">
            <span className="font-bold">EMPREENDIMENTO:</span>{' '}
            {dados.empreendimento || '---'}
          </p>
          <p className="text-[13px] text-gray-600">
            <span className="font-bold">BLOCO:</span> {dados.bloco || '---'}
            <span className="ml-6 font-bold">APARTAMENTO:</span>{' '}
            {dados.unidade || '---'}
          </p>
          <p className="text-[13px] text-gray-600">
            <span className="font-bold">SOLICITADO EM:</span>{' '}
            {formatarDataHora(dados.created_at)}
          </p>
          <p className="text-[13px] text-gray-600">
            <span className="font-bold">DATA DA VISTORIA:</span>{' '}
            {formatarDataCurta(dados.data_vistoria)}
          </p>
          <p className="text-[13px] text-gray-600">
            <span className="font-bold">DATA DO REPARO:</span>{' '}
            {formatarDataCurta(dados.data_reparo)}
          </p>
        </div>

        {/* ═══ DADOS DO MORADOR ═══ */}
        <Separator />
        <div className="py-4 space-y-2.5 pl-2">
          <p className="text-[13px] text-gray-600">
            <span className="font-bold">MORADOR:</span>{' '}
            {dados.proprietario || '---'}
          </p>
          <p className="text-[13px] text-gray-600">
            <span className="font-bold">CPF:</span> {dados.cpf || '---'}
          </p>
          <p className="text-[13px] text-gray-600">
            <span className="font-bold">TELEFONE:</span>{' '}
            {dados.telefone || '---'}
          </p>
        </div>
        <Separator />

        {/* ═══ 1. DESCRIÇÃO DO PROBLEMA ═══ */}
        <div className="mt-8 mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <SectionNumber num={1} />
            <h2 className="text-sm font-bold text-gray-600 tracking-wide">
              DESCRIÇÃO DO PROBLEMA
            </h2>
          </div>
          <div className="pl-2">
            <p className="text-[13px] text-gray-600 mb-2">
              <span className="font-bold">BLOCO:</span> {dados.bloco || '---'}
              <span className="ml-4 font-bold">APARTAMENTO:</span>{' '}
              {dados.unidade || '---'}
            </p>
            <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
              {dados.descricao_cliente || 'Sem descrição informada.'}
            </p>
          </div>
        </div>

        {/* ═══ 2. TÉC. RESPONSÁVEL ═══ */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <SectionNumber num={2} />
            <h2 className="text-sm font-bold text-gray-600 tracking-wide">
              TÉC. RESPONSÁVEL PELA ASSISTÊNCIA TÉCNICA
            </h2>
          </div>
          <div className="pl-2 flex items-baseline justify-between">
            <p className="text-[13px] text-gray-600">{tecNome}</p>
            <p className="text-[13px] text-gray-600">
              <span className="font-bold">NOTA:</span> {npsText}
            </p>
          </div>
        </div>

        {/* ═══ 3. PROVIDÊNCIAS ═══ */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <SectionNumber num={3} />
            <h2 className="text-sm font-bold text-gray-600 tracking-wide">
              PROVIDÊNCIAS
            </h2>
          </div>
          <div className="pl-2">
            <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
              {provText}
            </p>
          </div>
        </div>

        {/* ═══ BADGE ASSINATURA VENCIDA ═══ */}
        {dados.assinaturaVencida && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <p className="text-xs font-bold text-red-600">
              FINALIZADO — ASSINATURA VENCIDA (prazo de 7 dias expirado)
            </p>
            <p className="text-[10px] text-red-500 mt-0.5">
              Aceite por decurso de prazo — aceitação tácita
            </p>
          </div>
        )}
      </div>

      {/* ═══ SEPARAÇÃO ENTRE PÁGINAS ═══ */}
      <div className="h-3 bg-gray-100" />

      {/* ═══ PÁGINA 2 - TERMO DE RECEBIMENTO ═══ */}
      <div className="px-8 pt-8 pb-10">
        {/* Números de referência (repetidos na página 2) */}
        <div className="mb-6">
          <p className="text-[11px] font-bold text-gray-500 leading-relaxed tracking-wide">
            N° SOLICITAÇÃO: <span className="text-gray-700">{String(idChamado)}</span>
          </p>
          <p className="text-[11px] font-bold text-gray-500 leading-relaxed tracking-wide">
            N° FINALIZAÇÃO: <span className="text-gray-700">{String(idFinalizado)}</span>
          </p>
        </div>

        {/* Título */}
        <h1
          className="text-center text-lg font-bold mb-12 tracking-wide"
          style={{ color: 'rgb(70, 90, 140)' }}
        >
          SOLICITAÇÃO DE ASSISTÊNCIA TÉCNICA
        </h1>

        {/* Termo de Recebimento Box */}
        <div className="border border-gray-500 mb-8">
          <div className="border-b border-gray-500 px-4 py-2">
            <p className="text-sm font-bold text-gray-600">
              Termo de Recebimento dos Serviços de Assistência Técnica
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[13px] text-gray-600 leading-relaxed">
              Pelo presente termo, aceito os serviços prestados para correção
              das falhas apontadas acima, nada mais tendo a reclamar sobre os
              mesmos
            </p>
          </div>
        </div>

        {/* Local e data */}
        <div className="flex items-baseline justify-center gap-1 text-[13px] text-gray-600 mb-12">
          <span>(GO),_______ de</span>
          <span className="border-b border-gray-500 inline-block w-24" />
          <span>de</span>
          <span className="border-b border-gray-500 inline-block w-16" />
          <span>.</span>
        </div>

        {/* Área de assinatura com carimbo sobreposto */}
        <div className="relative">
          {/* Linha de assinatura */}
          <div className="flex flex-col items-center mb-10">
            <div className="border-b border-gray-500 w-56 mb-2" />
            <p className="text-[13px] text-gray-600">
              Assinatura do Proprietário/Representante
            </p>
          </div>

          {/* ═══ CARIMBO ASSINATURA VENCIDA — ACEITAÇÃO TÁCITA ═══ */}
          {dados.assinaturaVencida && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-24px' }}>
              <div
                className="flex flex-col items-center justify-center px-6 py-3 rounded-md"
                style={{
                  transform: 'rotate(-14deg)',
                  border: '3px double rgba(185, 28, 28, 0.75)',
                  backgroundColor: 'rgba(254, 242, 242, 0.45)',
                  boxShadow: 'inset 0 0 0 1.5px rgba(185, 28, 28, 0.35)',
                }}
              >
                <span
                  className="text-sm font-black tracking-widest leading-tight text-center"
                  style={{ color: 'rgba(185, 28, 28, 0.78)', letterSpacing: '0.12em' }}
                >
                  ASSINATURA VENCIDA
                </span>
                <span
                  className="text-[10px] font-bold tracking-wider leading-tight text-center mt-0.5"
                  style={{ color: 'rgba(185, 28, 28, 0.65)', letterSpacing: '0.15em' }}
                >
                  ACEITAÇÃO TÁCITA
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dados do representante */}
        <div className="space-y-4 px-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] text-gray-600 whitespace-nowrap">
              Nome Representante:
            </span>
            <span className="flex-1 border-b border-gray-400 text-[13px] text-gray-700 min-h-[1em] pl-1">
              {dados.nome_representante || ''}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] text-gray-600 whitespace-nowrap">
              CPF Representante:
            </span>
            <span className="flex-1 border-b border-gray-400 text-[13px] text-gray-700 min-h-[1em] pl-1">
              {dados.cpf_representante || ''}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] text-gray-600 whitespace-nowrap">
              Grau de afinidade:
            </span>
            <span className="flex-1 border-b border-gray-400 text-[13px] text-gray-700 min-h-[1em] pl-1">
              {dados.grau_afinidade || ''}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            EON Connect — Sistema de Gestão de Assistência Técnica
          </p>
          <p className="text-[10px] text-gray-400">
            Protocolo #{String(idChamado)}
          </p>
        </div>
      </div>

      {/* ═══ SEPARAÇÃO ENTRE PÁGINAS ═══ */}
      <div className="h-3 bg-gray-100" />

      {/* ═══ PÁGINA 3 - TERMO DE ASSISTÊNCIA TÉCNICA (texto legal) ═══ */}
      <div className="px-8 pt-8 pb-10">
        {/* Números de referência */}
        <div className="mb-6">
          <p className="text-[11px] font-bold text-gray-500 leading-relaxed tracking-wide">
            N° SOLICITAÇÃO: <span className="text-gray-700">{String(idChamado)}</span>
          </p>
          <p className="text-[11px] font-bold text-gray-500 leading-relaxed tracking-wide">
            N° FINALIZAÇÃO: <span className="text-gray-700">{String(idFinalizado)}</span>
          </p>
        </div>

        {/* Título */}
        <h1
          className="text-center text-lg font-bold mb-8 tracking-wide"
          style={{ color: 'rgb(70, 90, 140)' }}
        >
          TERMO DE ASSISTÊNCIA TÉCNICA
        </h1>

        <Separator />

        {/* Parágrafos do termo legal */}
        <div className="pt-6 space-y-4 pl-2">
          <p className="text-[13px] text-gray-600 leading-relaxed text-justify">
            Declaro que estou ciente de que, ao solicitar a assistência técnica por meio do sistema digital, autorizo a realização de vistoria, diagnóstico e, quando aplicável, reparo na minha unidade, conforme a solicitação registrada.
          </p>

          <p className="text-[13px] text-gray-600 leading-relaxed text-justify">
            Estou ciente de que, após a realização da vistoria técnica, será disponibilizado o termo técnico, contendo a descrição das constatações realizadas e o enquadramento da solicitação como procedente ou improcedente, conforme análise técnica.
          </p>

          <p className="text-[13px] text-gray-600 leading-relaxed text-justify">
            Nos casos em que a solicitação for considerada <span className="font-bold">PROCEDENTE</span>, após a conclusão do reparo será disponibilizado o termo técnico de reparo realizado, contendo a descrição dos serviços executados, sendo concedido o prazo de 07 (sete) dias corridos, contados a partir da conclusão do serviço, para análise, assinatura ou apresentação de eventual contestação, exclusivamente pelos canais oficiais de atendimento.
          </p>

          <p className="text-[13px] text-gray-600 leading-relaxed text-justify">
            Declaro, ainda, que a não assinatura do termo e a ausência de qualquer manifestação ou contestação dentro do prazo de 07 (sete) dias corridos serão consideradas, para todos os fins, como aceitação tácita, plena e irrevogável do reparo realizado ou do parecer técnico emitido, reconhecendo que o serviço foi executado de forma adequada e conforme a solicitação inicial.
          </p>

          <p className="text-[13px] text-gray-600 leading-relaxed text-justify">
            Nos casos em que a solicitação for considerada <span className="font-bold">IMPROCEDENTE</span>, fica consignado que o item analisado não apresenta vício construtivo, não se enquadra nas condições de garantia previstas no Manual do Proprietário e/ou decorre de uso inadequado, falta de manutenção, desgaste natural ou intervenção de terceiros, não sendo devido qualquer reparo por parte da construtora. Nessa hipótese, será concedido igualmente o prazo de 07 (sete) dias corridos, contados a partir da comunicação do resultado da vistoria, para eventual manifestação ou contestação pelos canais oficiais.
          </p>

          <p className="text-[13px] text-gray-600 leading-relaxed text-justify">
            Estou ciente de que, decorrido o referido prazo sem manifestação, o chamado será automaticamente encerrado, independentemente da minha assinatura, não sendo admitidas contestações posteriores relacionadas à mesma solicitação, ressalvadas apenas as hipóteses legalmente previstas.
          </p>

          <p className="text-[13px] text-gray-600 leading-relaxed text-justify">
            Reconheço que eventual nova reclamação, solicitação ou problema, ainda que relacionado à mesma unidade ou item analisado, deverá ser realizada por meio da abertura de novo chamado de assistência técnica, sujeitando-se às regras, prazos e condições vigentes à época da nova solicitação.
          </p>

          <p className="text-[13px] text-gray-600 leading-relaxed text-justify">
            Declaro, por fim, que as comunicações eletrônicas encaminhadas pelos meios cadastrados são válidas para fins de ciência da conclusão do reparo ou do resultado da vistoria, início da contagem dos prazos acima mencionados e encerramento do chamado, e que o presente termo possui validade jurídica, inclusive independentemente de assinatura física, a partir da minha concordância eletrônica no momento da solicitação do serviço.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            EON Connect — Sistema de Gestão de Assistência Técnica
          </p>
          <p className="text-[10px] text-gray-400">
            Protocolo #{String(idChamado)}
          </p>
        </div>
      </div>
    </div>
  );
}