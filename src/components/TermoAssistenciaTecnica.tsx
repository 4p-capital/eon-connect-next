"use client";

import { Button } from '@/components/ui/button';
import { ArrowLeft, FileCheck } from 'lucide-react';

interface TermoAssistenciaTecnicaProps {
  onVoltar: () => void;
}

export function TermoAssistenciaTecnica({ onVoltar }: TermoAssistenciaTecnicaProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 animate-slide-up">
          <div className="inline-flex items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl shadow-2xl mb-4 sm:mb-6 transform hover:scale-105 transition-transform duration-300">
            <FileCheck className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl text-gray-900 mb-3 sm:mb-4">
            Termo de Assistência Técnica
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto px-4">
            Leia atentamente as condições antes de solicitar assistência
          </p>
        </div>

        {/* Botão Voltar no topo */}
        <div className="mb-6">
          <Button
            onClick={onVoltar}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar para Solicitação
          </Button>
        </div>

        {/* Conteúdo */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl sm:rounded-[2rem] shadow-2xl overflow-hidden border border-white/50 p-6 sm:p-8 lg:p-12 space-y-8 animate-in fade-in duration-500">
          
          {/* Termo Completo */}
          <section>
            <h2 className="text-3xl sm:text-4xl text-gray-900 mb-6 pb-4 border-b-2 border-gray-200">
              Termo de Assistência Técnica
            </h2>

            <div className="prose prose-lg max-w-none space-y-6 text-gray-700 leading-relaxed">
              
              <p>
                Declaro que estou ciente de que, ao solicitar a assistência técnica por meio do sistema digital, autorizo a realização de vistoria, diagnóstico e, quando aplicável, reparo na minha unidade, conforme a solicitação registrada.
              </p>

              <p>
                Estou ciente de que, após a realização da vistoria técnica, será disponibilizado o termo técnico, contendo a descrição das constatações realizadas e o enquadramento da solicitação como procedente ou improcedente, conforme análise técnica.
              </p>

              <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-r-2xl">
                <p>
                  Nos casos em que a solicitação for considerada <strong>PROCEDENTE</strong>, após a conclusão do reparo será disponibilizado o termo técnico de reparo realizado, contendo a descrição dos serviços executados, sendo concedido o prazo de <strong className="text-green-700">07 (sete) dias corridos</strong>, contados a partir da conclusão do serviço, para análise, assinatura ou apresentação de eventual contestação, exclusivamente pelos canais oficiais de atendimento.
                </p>
              </div>

              <p>
                Declaro, ainda, que a não assinatura do termo e a ausência de qualquer manifestação ou contestação dentro do prazo de 07 (sete) dias corridos serão consideradas, para todos os fins, como <strong className="text-gray-900">aceitação tácita, plena e irrevogável</strong> do reparo realizado ou do parecer técnico emitido, reconhecendo que o serviço foi executado de forma adequada e conforme a solicitação inicial.
              </p>

              <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-2xl">
                <p>
                  Nos casos em que a solicitação for considerada <strong>IMPROCEDENTE</strong>, fica consignado que o item analisado não apresenta vício construtivo, não se enquadra nas condições de garantia previstas no Manual do Proprietário e/ou decorre de uso inadequado, falta de manutenção, desgaste natural ou intervenção de terceiros, não sendo devido qualquer reparo por parte da construtora. Nessa hipótese, será concedido igualmente o prazo de <strong className="text-red-700">07 (sete) dias corridos</strong>, contados a partir da comunicação do resultado da vistoria, para eventual manifestação ou contestação pelos canais oficiais.
                </p>
              </div>

              <p>
                Estou ciente de que, decorrido o referido prazo sem manifestação, o chamado será <strong>automaticamente encerrado</strong>, independentemente da minha assinatura, não sendo admitidas contestações posteriores relacionadas à mesma solicitação, ressalvadas apenas as hipóteses legalmente previstas.
              </p>

              <p>
                Reconheço que eventual nova reclamação, solicitação ou problema, ainda que relacionado à mesma unidade ou item analisado, deverá ser realizada por meio da <strong>abertura de novo chamado</strong> de assistência técnica, sujeitando-se às regras, prazos e condições vigentes à época da nova solicitação.
              </p>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-2xl">
                <p>
                  Declaro, por fim, que as comunicações eletrônicas encaminhadas pelos meios cadastrados são válidas para fins de ciência da conclusão do reparo ou do resultado da vistoria, início da contagem dos prazos acima mencionados e encerramento do chamado, e que o presente termo possui <strong className="text-blue-700">validade jurídica</strong>, inclusive independentemente de assinatura física, a partir da minha concordância eletrônica no momento da solicitação do serviço.
                </p>
              </div>

            </div>
          </section>

        </div>

        {/* Botão Voltar no rodapé */}
        <div className="mt-8 text-center">
          <Button
            onClick={onVoltar}
            variant="outline"
            className="flex items-center gap-2 mx-auto border-2 border-gray-900 text-gray-900 hover:bg-gray-50 px-6 py-3 rounded-xl shadow-lg transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar para Solicitação
          </Button>
        </div>
      </div>
    </div>
  );
}