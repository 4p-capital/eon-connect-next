"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { 
  Calendar as CalendarIcon, 
  Building2, 
  Clock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FileDown
} from 'lucide-react';
import type { Solicitacao } from '@/components/GerenciamentoAssistencia';

interface CalendarioAssistenciaProps {
  solicitacoes: Solicitacao[];
}

interface EventoAgendamento {
  id: number | string;
  data: Date;
  tipo: 'vistoria' | 'reparo';
  empreendimento: string;
  bloco: string;
  unidade: string;
  proprietario: string;
  hora: string;
  categoria_reparo: string;
  descricao_cliente?: string;
}

export function CalendarioAssistencia({ solicitacoes }: CalendarioAssistenciaProps) {
  const [mesAtual, setMesAtual] = useState(new Date());
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>(new Date());

  // Processar todos os agendamentos
  const eventos = useMemo(() => {
    const eventosLista: EventoAgendamento[] = [];

    solicitacoes.forEach((sol) => {
      // Adicionar eventos de vistoria
      if (sol.data_vistoria) {
        try {
          const dataVistoria = new Date(sol.data_vistoria);
          if (!isNaN(dataVistoria.getTime())) {
            eventosLista.push({
              id: sol.id,
              data: dataVistoria,
              tipo: 'vistoria',
              empreendimento: sol.empreendimento || 'Não informado',
              bloco: sol.bloco || '-',
              unidade: sol.unidade || '-',
              proprietario: sol.proprietario || 'Não informado',
              hora: dataVistoria.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo'
              }),
              categoria_reparo: sol.categoria_reparo || 'Não informado',
              descricao_cliente: sol.descricao_cliente
            });
          }
        } catch (e) {
          console.error('Erro ao processar data_vistoria:', e);
        }
      }

      // Adicionar eventos de reparo
      if (sol.data_reparo) {
        try {
          const dataReparo = new Date(sol.data_reparo);
          if (!isNaN(dataReparo.getTime())) {
            eventosLista.push({
              id: sol.id,
              data: dataReparo,
              tipo: 'reparo',
              empreendimento: sol.empreendimento || 'Não informado',
              bloco: sol.bloco || '-',
              unidade: sol.unidade || '-',
              proprietario: sol.proprietario || 'Não informado',
              hora: dataReparo.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo'
              }),
              categoria_reparo: sol.categoria_reparo || 'Não informado',
              descricao_cliente: sol.descricao_cliente
            });
          }
        } catch (e) {
          console.error('Erro ao processar data_reparo:', e);
        }
      }
    });

    // Ordenar por data e hora
    return eventosLista.sort((a, b) => a.data.getTime() - b.data.getTime());
  }, [solicitacoes]);

  // Função para verificar se uma data tem eventos
  const getEventosPorData = (data: Date) => {
    return eventos.filter((evento) => {
      const eventoData = new Date(evento.data);
      return (
        eventoData.getDate() === data.getDate() &&
        eventoData.getMonth() === data.getMonth() &&
        eventoData.getFullYear() === data.getFullYear()
      );
    });
  };

  // Obter eventos do dia selecionado
  const eventosDoDia = dataSelecionada ? getEventosPorData(dataSelecionada) : [];

  // Criar função para verificar tipo de evento na data
  const getDataKey = (date: Date) => {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const datasComEventos = useMemo(() => {
    const mapa = new Map<string, { vistoria: boolean; reparo: boolean }>();
    
    eventos.forEach((evento) => {
      const key = getDataKey(evento.data);
      const current = mapa.get(key) || { vistoria: false, reparo: false };
      
      if (evento.tipo === 'vistoria') {
        current.vistoria = true;
      } else {
        current.reparo = true;
      }
      
      mapa.set(key, current);
    });
    
    return mapa;
  }, [eventos]);

  const formatarData = (data: Date) => {
    return data.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Função para exportar PDF do dia selecionado
  const exportarPDF = async () => {
    if (!dataSelecionada || eventosDoDia.length === 0) {
      alert('Selecione um dia com agendamentos para exportar');
      return;
    }

    try {
      // Importar jsPDF dinamicamente
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
      const doc = new jsPDF();
      
      // Configurar fontes
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      
      // Título
      doc.text('EON Connect - Agendamentos', 105, 20, { align: 'center' });
      
      // Data selecionada
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(formatarData(dataSelecionada), 105, 30, { align: 'center' });
      
      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 35, 190, 35);
      
      // Estatísticas do dia
      const totalVistorias = eventosDoDia.filter(e => e.tipo === 'vistoria').length;
      const totalReparos = eventosDoDia.filter(e => e.tipo === 'reparo').length;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo do Dia:', 20, 45);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Vistorias: ${totalVistorias}`, 20, 52);
      doc.text(`• Reparos: ${totalReparos}`, 20, 58);
      doc.text(`• Total: ${eventosDoDia.length}`, 20, 64);
      
      // Cabeçalho da tabela
      let y = 75;
      doc.setFillColor(59, 130, 246); // Azul
      doc.rect(20, y, 170, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Hora', 23, y + 5.5);
      doc.text('Tipo', 38, y + 5.5);
      doc.text('Categoria', 56, y + 5.5);
      doc.text('Empreendimento', 90, y + 5.5);
      doc.text('Local', 130, y + 5.5);
      doc.text('Proprietário', 158, y + 5.5);
      
      // Linhas da tabela
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      
      eventosDoDia.forEach((evento, index) => {
        // Alternar cor de fundo da linha
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(20, y, 170, 7, 'F');
        }
        
        // Colorir célula do tipo com cores vibrantes
        if (evento.tipo === 'vistoria') {
          // Laranja vibrante para Vistoria
          doc.setFillColor(255, 145, 0);
          doc.rect(36, y, 16, 7, 'F');
          doc.setTextColor(255, 255, 255); // Texto branco
        } else {
          // Roxo vibrante para Reparo
          doc.setFillColor(147, 51, 234);
          doc.rect(36, y, 16, 7, 'F');
          doc.setTextColor(255, 255, 255); // Texto branco
        }
        
        // Conteúdo - Hora
        doc.setTextColor(0, 0, 0); // Texto preto para hora
        doc.text(evento.hora, 23, y + 5);
        
        // Tipo (texto branco já definido acima)
        doc.text(evento.tipo === 'vistoria' ? 'Vist.' : 'Rep.', 38, y + 5);
        
        // Resto do conteúdo em preto
        doc.setTextColor(0, 0, 0);
        doc.text(evento.categoria_reparo.substring(0, 18), 56, y + 5);
        doc.text(evento.empreendimento.substring(0, 22), 90, y + 5);
        doc.text(`${evento.bloco}-${evento.unidade}`, 130, y + 5);
        doc.text(evento.proprietario.substring(0, 15), 158, y + 5);
        
        // Borda da célula
        doc.setDrawColor(220, 220, 220);
        doc.rect(20, y, 170, 7);
        
        y += 7;
        
        // Adicionar descrição do problema (se existir)
        if (evento.descricao_cliente) {
          doc.setFontSize(6);
          doc.setTextColor(80, 80, 80);
          doc.setFont('helvetica', 'italic');
          
          // Quebrar texto longo em múltiplas linhas
          const descricaoTexto = `Descrição: ${evento.descricao_cliente}`;
          const linhasDescricao = doc.splitTextToSize(descricaoTexto, 165);
          
          // Calcular altura necessária para a descrição
          const alturaDescricao = linhasDescricao.length * 3.5;
          
          // Verificar se precisa de nova página antes de adicionar a descrição
          if (y + alturaDescricao > 270) {
            doc.addPage();
            y = 20;
          }
          
          // Fundo cinza claro para a descrição
          doc.setFillColor(245, 245, 245);
          doc.rect(20, y, 170, alturaDescricao, 'F');
          
          // Adicionar linhas de texto
          linhasDescricao.forEach((linha: string, i: number) => {
            doc.text(linha, 23, y + 3 + (i * 3.5));
          });
          
          // Borda da descrição
          doc.setDrawColor(220, 220, 220);
          doc.rect(20, y, 170, alturaDescricao);
          
          y += alturaDescricao;
          
          // Resetar fonte
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
        }
        
        // Nova página se necessário
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });
      
      // Borda final
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.rect(20, 75, 170, y - 75);
      
      // Rodapé
      const pageCount = (doc.internal as any).getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(
          `Página ${i} de ${pageCount}`,
          105,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
        doc.text(
          `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
          105,
          doc.internal.pageSize.height - 5,
          { align: 'center' }
        );
      }
      
      // Salvar PDF
      const nomeArquivo = `agendamentos-${dataSelecionada.toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      doc.save(nomeArquivo);
      
      console.log('✅ PDF gerado com sucesso:', nomeArquivo);
    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const proximoMes = () => {
    const novaData = new Date(mesAtual);
    novaData.setMonth(novaData.getMonth() + 1);
    setMesAtual(novaData);
  };

  const mesAnterior = () => {
    const novaData = new Date(mesAtual);
    novaData.setMonth(novaData.getMonth() - 1);
    setMesAtual(novaData);
  };

  // Personalizar dias do calendário
  const modifiers = useMemo(() => {
    const datasVistoria: Date[] = [];
    const datasReparo: Date[] = [];

    eventos.forEach((evento) => {
      const data = new Date(evento.data);
      data.setHours(0, 0, 0, 0);
      
      if (evento.tipo === 'vistoria') {
        datasVistoria.push(data);
      } else {
        datasReparo.push(data);
      }
    });

    return {
      vistoria: datasVistoria,
      reparo: datasReparo
    };
  }, [eventos]);

  return (
    <div className="space-y-6">
      {/* Header com informações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 mb-1">Vistorias Agendadas</p>
                <p className="text-3xl text-orange-900">
                  {eventos.filter(e => e.tipo === 'vistoria').length}
                </p>
              </div>
              <div className="bg-orange-500 p-3 rounded-full">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Reparos Agendados</p>
                <p className="text-3xl text-gray-900">
                  {eventos.filter(e => e.tipo === 'reparo').length}
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded-full">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 mb-1">Total de Agendamentos</p>
                <p className="text-3xl text-blue-900">
                  {eventos.length}
                </p>
              </div>
              <div className="bg-blue-500 p-3 rounded-full">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Calendário */}
        <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg w-full">
          <CardHeader className="w-full">
            <div className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
                Calendário de Agendamentos
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={mesAnterior}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm min-w-[120px] text-center capitalize">
                  {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={proximoMes}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 w-full">
            <style>{`
              .calendar-full-width {
                width: 100% !important;
                max-width: 100% !important;
              }
              .calendar-full-width * {
                max-width: 100%;
              }
              .calendar-full-width > div {
                width: 100% !important;
              }
              .calendar-full-width .rdp {
                width: 100%;
              }
              .calendar-full-width .rdp-months {
                width: 100%;
              }
              .calendar-full-width .rdp-month {
                width: 100%;
              }
              .calendar-full-width .rdp-caption {
                width: 100%;
              }
              .calendar-full-width table {
                width: 100% !important;
                table-layout: fixed;
              }
              .calendar-full-width thead th {
                padding: 0.75rem;
                width: 14.28%;
              }
              .calendar-full-width tbody td {
                padding: 0.5rem;
                width: 14.28%;
              }
              .calendar-full-width tbody button {
                width: 100%;
              }
              .calendar-day-vistoria {
                position: relative;
              }
              .calendar-day-vistoria::after {
                content: '';
                position: absolute;
                bottom: 2px;
                left: 50%;
                transform: translateX(-50%);
                width: 6px;
                height: 6px;
                background-color: #FF9100;
                border-radius: 50%;
              }
              .calendar-day-reparo {
                position: relative;
              }
              .calendar-day-reparo::before {
                content: '';
                position: absolute;
                bottom: 2px;
                left: 35%;
                transform: translateX(-50%);
                width: 6px;
                height: 6px;
                background-color: #581c87;
                border-radius: 50%;
              }
              .calendar-day-vistoria.calendar-day-reparo::after {
                left: 65%;
              }
            `}</style>
            <div className="w-full">
              <Calendar
                mode="single"
                selected={dataSelecionada}
                onSelect={setDataSelecionada}
                month={mesAtual}
                onMonthChange={setMesAtual}
                className="rounded-md border-0 calendar-full-width w-full"
                modifiers={modifiers}
                modifiersClassNames={{
                  vistoria: 'calendar-day-vistoria',
                  reparo: 'calendar-day-reparo'
                }}
              />
            </div>
            
            {/* Legenda */}
            <div className="mt-4 pt-4 border-t flex items-center justify-center gap-6 w-full">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF9100]"></div>
                <span className="text-sm text-gray-600">Vistoria</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-900"></div>
                <span className="text-sm text-gray-600">Reparo</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de eventos do dia */}
        <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {dataSelecionada ? formatarData(dataSelecionada) : 'Selecione uma data'}
              </CardTitle>
              {eventosDoDia.length > 0 && (
                <Button
                  onClick={exportarPDF}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Exportar PDF
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {eventosDoDia.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhum agendamento nesta data</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">{eventosDoDia.map((evento, index) => (
                  <Card 
                    key={`${evento.id}-${evento.tipo}-${index}`}
                    className={`border-l-4 ${
                      evento.tipo === 'vistoria' 
                        ? 'border-l-[#FF9100] bg-orange-50/50' 
                        : 'border-l-gray-900 bg-gray-50/50'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        {/* Tipo e Hora */}
                        <div className="flex items-center justify-between">
                          <Badge 
                            className={
                              evento.tipo === 'vistoria'
                                ? 'bg-[#FF9100] text-white hover:bg-[#FF9100]'
                                : 'bg-gray-900 text-white hover:bg-gray-900'
                            }
                          >
                            {evento.tipo === 'vistoria' ? 'Vistoria' : 'Reparo'}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Clock className="h-3.5 w-3.5" />
                            {evento.hora}
                          </div>
                        </div>

                        {/* Empreendimento */}
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900">
                              {evento.empreendimento}
                            </p>
                            <p className="text-xs text-gray-600">
                              Bloco {evento.bloco} - Apto {evento.unidade}
                            </p>
                          </div>
                        </div>

                        {/* Proprietário */}
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                          <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <p className="text-xs text-gray-600 truncate">
                            {evento.proprietario}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}