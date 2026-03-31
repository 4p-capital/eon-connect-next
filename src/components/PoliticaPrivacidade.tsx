"use client";

import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';

interface PoliticaPrivacidadeProps {
  onVoltar: () => void;
}

export function PoliticaPrivacidade({ onVoltar }: PoliticaPrivacidadeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 animate-slide-up">
          <div className="inline-flex items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl shadow-2xl mb-4 sm:mb-6 transform hover:scale-105 transition-transform duration-300">
            <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl text-gray-900 mb-3 sm:mb-4">
            Política de Privacidade
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto px-4">
            BP Incorporadora - Proteção e Transparência no Tratamento dos seus Dados
          </p>
        </div>

        {/* Botão Voltar no topo */}
        <div className="mb-6">
          <Button
            onClick={onVoltar}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar para Solicitação
          </Button>
        </div>

        {/* Conteúdo */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl sm:rounded-[2rem] shadow-2xl overflow-hidden border border-white/50 p-6 sm:p-8 lg:p-12 space-y-8 animate-in fade-in duration-500">
          
          {/* Resumo */}
          <section className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
            <h2 className="text-2xl sm:text-3xl text-gray-900 mb-4">
              Resumo da Nossa Política de Privacidade
            </h2>
            <p className="text-base text-gray-700 mb-6">
              Na BP Incorporadora, sua privacidade é fundamental. Este é um resumo rápido de como cuidamos dos seus dados. Para todos os detalhes, por favor leia a política completa abaixo.
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">O que coletamos?</h3>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  <li><strong>Informações que você nos dá:</strong> Nome, e-mail, telefone, CPF, etc., quando você preenche formulários ou se cadastrar no nosso Portal.</li>
                  <li><strong>Informações de navegação:</strong> Dados sobre como você usa nosso site, como seu endereço IP e páginas visitadas, coletados através de cookies.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Para que usamos seus dados?</h3>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  <li>Para prestar nossos serviços (como cadastrá-lo no Portal do Cliente).</li>
                  <li>Para nos comunicarmos com você sobre seu contrato e nossos serviços.</li>
                  <li>Para enviar marketing e novidades, apenas se você consentir.</li>
                  <li>Para cumprir obrigações legais e garantir a segurança do nosso site.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Com quem compartilhamos?</h3>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  <li>Com empresas parceiras que nos ajudam a operar (ex: serviços de nuvem, análise de dados).</li>
                  <li>Com empresas do nosso grupo para fins estatísticos e publicitários.</li>
                  <li>Com autoridades públicas, se a lei exigir.</li>
                </ul>
                <p className="text-gray-700 mt-2">Nós garantimos que nossos parceiros também protejam seus dados.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Quais são seus direitos?</h3>
                <p className="text-gray-700 mb-2">Você tem total controle sobre seus dados. A qualquer momento, você pode pedir para:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  <li>Acessar, corrigir ou atualizar seus dados.</li>
                  <li>Cancelar seu consentimento (como para receber marketing).</li>
                  <li>Pedir a exclusão das suas informações.</li>
                </ul>
                <p className="text-gray-700 mt-2">Para exercer seus direitos, basta entrar em contato com nosso Encarregado de Dados (DPO).</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Cookies:</h3>
                <p className="text-gray-700">Usamos cookies para melhorar sua experiência no nosso site. Você pode gerenciar suas preferências de cookies diretamente no seu navegador ou em nosso aviso de cookies.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Segurança:</h3>
                <p className="text-gray-700">Levamos a segurança a sério e usamos as melhores tecnologias para proteger suas informações.</p>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 mt-4">
                <p className="text-sm text-gray-800">
                  <strong>Importante:</strong> Este resumo é um guia rápido e não substitui a leitura da Política de Privacidade completa, que contém todos os detalhes e é o documento legalmente válido que rege o tratamento dos seus dados.
                </p>
              </div>
            </div>
          </section>

          {/* Política Completa */}
          <section className="space-y-8">
            <h2 className="text-3xl sm:text-4xl text-gray-900 text-center border-b-4 border-blue-600 pb-4">
              POLÍTICA DE PRIVACIDADE, COOKIES E TERMOS DE USO
            </h2>

            <p className="text-base text-gray-700 leading-relaxed">
              A BP Incorporadora respeita a privacidade de todos os seus clientes. Entendemos que a proteção de seus dados pessoais e de sua privacidade são elementos essenciais para a BP INCORPORADORA e que o tratamento de dados pessoais e registros eletrônicos deixados por você ("Usuário/Cliente") na utilização do Website e Portal do Cliente da BP Incorporadora, além de seus Serviços interativos, constituem parte fundamental da nossa missão de proporcionar um serviço cada vez melhor. Através de nossa Política de Privacidade ("Política"), esclarecemos alguns pontos importantes para garantir a sua segurança sobre como obtemos, armazenamos, utilizamos e compartilhamos as suas informações pessoais.
            </p>

            {/* Seção 1 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">1. ACEITE</h3>
              <div className="space-y-3 text-gray-700">
                <p>1.1. Ao acessar o Website ou o Portal do Cliente da BP Incorporadora, Você deverá ler o conteúdo desta Política e, se estiver de acordo com as condições apresentadas, manifestar o seu consentimento livre, expresso, informado e inequívoco, por meio da seleção correspondente à opção "Aceitar e Fechar" no modal box de aceite. Tal consentimento poderá ser revogado a qualquer momento, por meio de um de nossos Canais de Atendimento.</p>
                <p>1.2. Entretanto, ao revogar o seu consentimento, Você compreende que isso poderá restringir, suspender ou cancelar alguns e/ou todos os Serviços ofertados pela BP Incorporadora. De todo modo, assim que nós recebermos a sua solicitação, seus Dados Pessoais serão excluídos, salvo em casos em que a lei permitir seu armazenamento ou que as informações sejam necessárias para o cumprimento de obrigação legal e/ou regulatória.</p>
              </div>
            </div>

            {/* Seção 2 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">2. DEFINIÇÕES</h3>
              <div className="space-y-3 text-gray-700">
                <p>2.1. A Política de Privacidade será regida pelas definições dos termos em maiúsculo estabelecidas nos Termos de Uso do Website e do Portal do Cliente da BP Incorporadora, além dos abaixo listados. Caso haja algum termo não abordado nesta Política ou nos Termos de Uso, a interpretação deverá ser de acordo com a Legislação Brasileira:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>(i) Dado Pessoal:</strong> informações relacionadas a Você, que te identificam ou podem vir a te identificar;</li>
                  <li><strong>(ii) Dado Pessoal Sensível:</strong> são seus dados sobre origem racial ou étnica, convicção religiosa, opinião política, filiação à sindicato ou a organização de caráter religioso, filosófico ou político, dado referente à saúde ou à vida sexual, dado genético ou biométrico que, em conjunto com Dado Pessoal, serão denominados Dados Pessoais;</li>
                  <li><strong>(iii) Tratamento:</strong> toda operação que realizarmos com seus Dados Pessoais, como as que se referem a coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou extração;</li>
                  <li><strong>(iv) Controlador:</strong> no âmbito desta Política, e no escopo do nosso relacionamento com Você, a BP Incorporadora, a quem competem as decisões referentes ao Tratamento dos seus Dados Pessoais;</li>
                  <li><strong>(v) Operador:</strong> pessoa natural ou jurídica, de direito público ou privado, que realiza o Tratamento de Dados Pessoais em nome do Controlador;</li>
                  <li><strong>(vi) Titular dos Dados:</strong> no âmbito desta Política, Você ("Usuário" ou "Cliente"), pessoa natural a quem se referem os Dados Pessoais que são objeto de Tratamento.</li>
                </ul>
              </div>
            </div>

            {/* Seção 3 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">3. SOBRE OS DADOS FORNECIDOS À BP INCORPORADORA</h3>
              <div className="space-y-3 text-gray-700">
                <p>3.1. Os Dados Pessoais fornecidos por Você no Website e no Portal do Cliente da BP Incorporadora contribuem para o propósito de melhor prestação de nossos Serviços e ainda nos ajudam a melhorar nossas páginas, tornando-as cada vez mais direcionadas às necessidades e às informações que nossos Usuários e Clientes buscam.</p>
                <p>3.2. A BP Incorporadora poderá coletar informações inseridas voluntariamente por você, no momento do cadastro no Portal do Cliente, na solicitação de preenchimento de formulários disponíveis em nossas páginas e, ainda, informações disponíveis automaticamente, quando da utilização de nossas páginas, como, por exemplo, IP com data e hora da conexão.</p>
                <p>3.3. Desse modo, realizamos o tratamento de dois tipos de dados pessoais: (i) aqueles fornecidos pelo próprio Usuário, de forma ativa e voluntária; e (ii) aqueles coletados automaticamente.</p>
                <p><strong>(i) Informações fornecidas pelo Usuário, de forma ativa e voluntária:</strong> a BP Incorporadora coleta todas as informações inseridas voluntariamente pelo Usuário em suas Páginas, tais como nome completo, e-mail, data de nascimento, cidade e estado, quando do preenchimento de formulários para acesso a determinados Serviços, solicitação de agendamentos e atendimentos ou acesso ao canal de comunicação da BP Incorporadora. Para acessar o Portal do Cliente, você deverá fornecer seu CPF ou CNPJ, um e-mail e também poderá utilizar a opção de login com sua conta do Facebook ou do Google+, permitindo que a BP Incorporadora acesse suas informações referentes ao nome, foto de perfil e e-mail, a depender das configurações de privacidade feitas por você em sua rede social.</p>
                <p><strong>(ii) Informações coletadas automaticamente:</strong> a BP Incorporadora também coleta informações de modo automático, por meio da utilização de seu Website ou do Portal do Cliente, tais como características do sistema operacional do dispositivo utilizado pelo Usuário/Cliente, fabricante do dispositivo de acesso, operadora, endereço IP, provedor de serviços de Internet (ISP), informações de tela e resolução, endereço do protocolo de internet (IP), tempo médio gasto em cada página, data e localização de acesso às páginas, dentre outros.</p>
                <p>3.4. Caso o Usuário/Cliente acesse os Canais de Comunicação da BP Incorporadora, os registros serão mantidos para fins de segurança.</p>
              </div>
            </div>

            {/* Seção 4 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">4. COMO OS DADOS PESSOAIS SÃO UTILIZADOS</h3>
              <div className="space-y-3 text-gray-700">
                <p>4.1. Os Dados Pessoais coletados e tratados pela BP Incorporadora possuem o propósito de melhorar a prestação de seus serviços através de suas Páginas, buscando prover soluções imobiliárias que atendam às necessidades dos nossos clientes, de maneira adequada às suas preferências. Listamos algumas finalidades específicas e suas respectivas bases legais abaixo:</p>
                
                <p><strong>a) Cadastro do Cliente no Portal do Cliente:</strong> Para que o Cliente da BP Incorporadora possua acesso a nossos Serviços exclusivos, relacionados à compra de seu imóvel, financiamentos e registros, seus Dados Pessoais serão utilizados para efetivar seu cadastro em nosso Portal do Cliente. <em>Base Legal:</em> Este tratamento é necessário para a execução de contrato ou de procedimentos preliminares relacionados a contrato do qual seja parte o titular (Art. 7º, V, LGPD).</p>

                <p><strong>b) Comunicação:</strong> Para facilitar o contato com o Usuário/Cliente, a BP Incorporadora poderá utilizar suas informações pessoais para, periodicamente, enviar notificações e avisos sobre alterações em prazos, condições e políticas, comunicados sobre emissão de documentos, agendamento de serviços e solicitação de atendimento. <em>Base Legal:</em> Este tratamento é necessário para a execução de contrato (Art. 7º, V, LGPD).</p>

                <p><strong>c) Marketing:</strong> Para fins publicitários de serviços e promoções oferecidas pela BP Incorporadora, os Dados Pessoais coletados poderão ser utilizados para o envio de e-mail marketing, SMS, E-Marketing e mensagens via redes sociais ou aplicativos de comunicação para Usuários/Clientes e até mesmo investidores que se cadastraram na lista de e-mails da BP Incorporadora e consentiram – de forma livre, expressa, informada e inequívoca – para o recebimento de mensagens. A BP Incorporadora também poderá mandar mensagens para manter relacionamento com a base de destinatários ou, ainda, propiciar atendimento ao cliente. O Usuário poderá optar pela remoção de seu endereço eletrônico da base de destinatários de e-mail marketing da BP Incorporadora, através do link de descadastramento que aparecerá ao final do corpo da mensagem de e-mail enviada ("Solicitar descadastramento de newsletter/mailing"). <em>Base Legal:</em> Este tratamento de dados para fins de marketing é realizado com base no seu consentimento (Art. 7º, I, LGPD), que pode ser retirado a qualquer momento.</p>

                <p><strong>d) Cumprimento de obrigação legal e/ou regulatória:</strong> Para fins de cumprimento de obrigação legal e de manter a segurança de seus serviços, a BP Incorporadora poderá utilizar suas informações pessoais para responder a requisições de autoridades competentes em investigações de atividades ilícitas, a processos judiciais e a procedimentos litigiosos, nos termos da legislação aplicável. <em>Base Legal:</em> Este tratamento é realizado para o cumprimento de obrigação legal ou regulatória pelo controlador (Art. 7º, II, LGPD).</p>

                <p><strong>e) Promoção, melhoria e desenvolvimento de nossos Serviços;</strong></p>
                <p><strong>f) Realização de auditorias internas e externas;</strong></p>
                <p><strong>g) Prevenção antifraude e segurança de nossos Serviços;</strong></p>
                <p><strong>h) Análises relacionadas à segurança de nossas páginas para a prevenção de erros e falhas técnicas;</strong></p>
                <p><strong>i) Mapeamento de informações de mercado, estatísticas e elaboração de relatórios;</strong></p>
                <p><strong>j) Pesquisas de satisfação.</strong></p>
                <p><em>Base Legal (para os itens 'e' a 'j'):</em> O tratamento destes dados é realizado para atender aos interesses legítimos da BP Incorporadora (Art. 7º, IX, LGPD), sempre respeitando os direitos e liberdades fundamentais do titular e nunca utilizando os dados para fins ilícitos ou abusivos.</p>
              </div>
            </div>

            {/* Seção 5 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">5. LINKS DE TERCEIROS</h3>
              <div className="space-y-3 text-gray-700">
                <p>5.1. A BP Incorporadora, em suas Páginas, fornece links para conexão com outros sites que não fazem parte de seu domínio, redirecionando nossos Usuários/Clientes para sites externos de terceiros. A BP Incorporadora não é responsável por quaisquer danos ou prejuízos relacionados com a utilização de Serviços, conteúdo, recursos ou outras interatividades advindas desses sites externos.</p>
                <p>5.2. A BP Incorporadora não se responsabiliza pelos dados fornecidos e tratados pelos sites externos, que seguem termos e políticas de privacidade próprias. Recomendamos que o Usuário/Cliente verifique estes termos e políticas externas antes de utilizar os serviços de terceiros.</p>
              </div>
            </div>

            {/* Seção 6 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">6. COOKIES E OUTRAS FERRAMENTAS DE RASTREAMENTO</h3>
              <div className="space-y-3 text-gray-700">
                <p>6.1. Cookies são pequenos arquivos que podem ou não ser adicionados no seu dispositivo eletrônico, e que permitem armazenar e reconhecer dados de sua navegação.</p>
                <p>6.2. Para a coleta e tratamento de Dados Pessoais, a BP Incorporadora fará uso de cookies, com o propósito de melhorar o entendimento sobre o comportamento do Usuário/Cliente no Website e Portal do Cliente da BP Incorporadora, ajudando a medir a eficácia de campanhas, pesquisas, bem como para controle interno de audiência e de preferências. Em sua navegação, poderão ser utilizados os seguintes tipos de cookies:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Estritamente necessários:</strong> Estes cookies são essenciais para permitir a movimentação do Usuário no site da BP Incorporadora e fornecer acesso a recursos e funcionalidades aqui disponíveis. Essa categoria de cookies não pode ser desativada do nosso sistema.</li>
                  <li><strong>Funcionais:</strong> Esses cookies possibilitam que as Páginas da BP Incorporadora se lembrem de suas escolhas, para se adequar às suas necessidades de forma personalizada. Essa categoria de cookies também permite indicar como os Usuários trafegam em nossas Páginas.</li>
                  <li><strong>Marketing:</strong> Esses cookies são utilizados para fornecer uma melhor segmentação para o Marketing, por meio de publicidade mais direcionada ao interesse do Usuário e de informações oriundas de conteúdo considerado mais relevante ao Usuário. Também, permitem indicar, às Páginas da BP Incorporadora, os sites que o Usuário visitou.</li>
                </ul>
                <p>6.3. Você poderá personalizar suas preferências de cookies por meio de um mecanismo de obtenção de consentimento (opt-in), que se abrirá no formato de um checkbox no Website e no Portal do Cliente da BP Incorporadora; ou por meio das configurações de seu navegador.</p>
                <p>6.4. Você está ciente de que o Website e o Portal do Cliente da BP Incorporadora podem não funcionar de maneira satisfatória caso não seja aceito algumas categorias de cookies.</p>
              </div>
            </div>

            {/* Seção 7 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">7. PERÍODO DE RETENÇÃO</h3>
              <div className="space-y-3 text-gray-700">
                <p>7.1. A BP Incorporadora armazenará suas informações durante o período necessário para o cumprimento das finalidades apresentadas nesta Política. Levamos em consideração os seguintes critérios para a retenção dos seus dados:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Enquanto sua conta no Portal do Cliente estiver ativa;</li>
                  <li>Pelo tempo exigido por obrigações legais ou regulatórias. A título de exemplo, dados relacionados a transações financeiras e fiscais serão mantidos pelo prazo mínimo de 5 (cinco) anos após o término da relação contratual;</li>
                  <li>Para o exercício regular de direitos em processo judicial, administrativo ou arbitral;</li>
                  <li>Dados coletados com base no seu consentimento (como para fins de marketing) serão mantidos até a solicitação de revogação do consentimento pelo titular.</li>
                </ul>
                <p>7.2. Em determinados casos, a BP Incorporadora poderá reter seus dados pessoais para fins comerciais legítimos, tais como prevenção a fraudes, aprimoramento da segurança, bem como em hipóteses de retenção de registros prevista em dispositivos normativos.</p>
                <p>7.3. A BP Incorporadora se compromete a excluir seus Dados Pessoais, interrompendo o seu tratamento, no momento em que não haja mais uma conta ativa pelo usuário e o mesmo solicite revogar o seu consentimento, armazenando apenas as informações permitidas e/ou determinadas pela Legislação Brasileira.</p>
                <p>7.4. Poderemos também excluir seus dados, interrompendo o tratamento destes, mediante determinação de autoridade competente e/ou ordem judicial.</p>
                <p>7.5. Você também poderá requerer a exclusão dos seus dados entrando em contato conosco, por meio dos nossos Canais de Atendimento. A BP Incorporadora se compromete a empreender todos os esforços razoáveis para atender os seus pedidos, caso sejam cabíveis, no menor tempo possível e em cumprimento à Legislação Brasileira.</p>
                <p>7.6. Você se declara ciente de que a exclusão de algumas informações poderá gerar uma impossibilidade de acesso a alguns e/ou todos os Serviços do Website e do Portal do Cliente da BP Incorporadora, em decorrência das nossas necessidades operacionais.</p>
                <p>7.7. A BP Incorporadora se reserva o direito de manter armazenados em seus servidores os dados necessários ao cumprimento da Legislação Brasileira, ainda que diante de requisição de exclusão pelo Usuário.</p>
                <p>7.8. A BP Incorporadora se reserva o direito de reter informações que não identifiquem o Usuário pessoalmente, mesmo após o encerramento da conta no Portal do Cliente, desde que de forma agregada ou anonimizada.</p>
              </div>
            </div>

            {/* Seção 8 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">8. COMPARTILHAMENTO DE DADOS PESSOAIS</h3>
              <div className="space-y-3 text-gray-700">
                <p>8.1. Os seus Dados Pessoais poderão ser compartilhados de acordo com as finalidades específicas listadas nesta Política. A BP Incorporadora se compromete a fazer com parceiros que empreguem alto nível de segurança da informação, estabelecendo cláusulas contratuais protetivas que não violem as disposições desta Política. Além disso, listamos abaixo as hipóteses de compartilhamento de suas informações:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>8.1.1. Com nossos Operadores, que nos auxiliem na prestação de nossos Serviços aos Usuários/Clientes;</li>
                  <li>8.1.2. Com empresas parceiras licenciadas, para o oferecimento de serviços de suporte e feedback/sugestões;</li>
                  <li>8.1.3. Com Facebook ou Google, na hipótese de cadastro por meio de conta da rede social;</li>
                  <li>8.1.4. Com empresas do mesmo grupo econômico da BP Incorporadora, para fins publicitários, estatísticos e para prestação dos Serviços do Website e do Portal do Cliente;</li>
                  <li>8.1.5. Com empresas de consultoria e escritórios de advocacia, para proteção dos nossos interesses, incluindo casos de demandas judiciais, administrativas e arbitrais;</li>
                  <li>8.1.6. Em caso de operações societárias, quando a transferência dos Dados Pessoais for necessária para a continuidade dos Serviços ofertados, ou quando garantidos meios de anonimização;</li>
                  <li>8.1.7. Com empresas fornecedoras, para armazenamento em nuvem, gerenciamento de banco de dados, análise de dados e melhorias das funcionalidades, incluindo marketing;</li>
                  <li>8.1.8. Mediante ordem judicial ou por requerimento de Autoridades Públicas ou Reguladoras que detenham competência para requisição;</li>
                  <li>8.1.9. Com empresas de auditorias e análise de qualidade da prestação dos Serviços da BP Incorporadora;</li>
                  <li>8.1.10. Com órgãos e autoridades públicas, para fins de cumprimento de obrigações legais e/ou regulatórias.</li>
                </ul>
              </div>
            </div>

            {/* Seção 9 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">9. SEGURANÇA DAS INFORMAÇÕES</h3>
              <div className="space-y-3 text-gray-700">
                <p>9.1. A BP Incorporadora aplica todos os esforços razoáveis e necessários, considerando as soluções tecnológicas disponíveis e aplicáveis, para garantir a privacidade e a proteção dos dados pessoais de seus Usuários e Cliente, tratando suas informações pessoais de forma sigilosa e confidencial.</p>
                <p>9.2. Todos os Dados Pessoais tratados pela BP Incorporadora serão armazenados em servidores próprios ou em serviços de nuvem confiáveis, de parceiros que podem estar localizados no Brasil ou no exterior. Quando houver transferência internacional de dados (para países como os da União Europeia ou Estados Unidos), a BP Incorporadora garante que esta ocorrerá apenas para países que proporcionem um grau de proteção de dados adequado ao previsto na LGPD ou, na ausência dessa adequação, mediante a utilização de garantias contratuais e mecanismos legais que assegurem o cumprimento dos princípios e direitos dos titulares.</p>
                <p>9.3. Todos os dados são devidamente armazenados em um banco de dados seguro e com acesso restrito a poucos funcionários, que são obrigados, por contrato, a manter o sigilo sobre as informações, assim como não as utilizarem de forma inadequada, sob pena de responsabilização nos moldes da legislação aplicável.</p>
                <p>9.4. A BP Incorporadora toma todas as medidas técnicas e administrativas a seu alcance para a manutenção da confidencialidade e da segurança de seus dados, precavendo suas informações contra acessos desautorizados e situações acidentais ou ilícitas de destruição, roubo, perda, alteração indevida, comunicação, difusão ou divulgação de suas informações, tais como:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>(i) emprego de ferramentas de alta tecnologia para proteção contra acessos não autorizados ao Website e Portal do Cliente da BP Incorporadora;</li>
                  <li>(ii) acesso a locais de armazenamento de Dados Pessoais apenas por pessoas previamente autorizadas e comprometidas com o sigilo dos dados, inclusive mediante assinatura de termo de confidencialidade;</li>
                  <li>(iii) aplicação de mecanismos de autenticação de acesso aos registros capazes de individualizar o responsável pelo tratamento dos dados coletados em decorrência da utilização de nosso Website e Portal do Cliente;</li>
                  <li>(iv) sistemas de monitoramento e testes de segurança anuais, entre outras práticas em prol da segurança da informação e dos Dados Pessoais.</li>
                  <li>(v) aplicação de protocolos de criptografia de dados trafegados nos sites da BP Incorporadora, em prol da segurança da informação e dos Dados Pessoais.</li>
                </ul>
                <p>9.5. Apesar disso, não é possível garantir de forma absoluta a não ocorrência de erros no sistema, incidentes de segurança, violações e acessos não autorizados, considerando que as práticas de segurança da internet encontram-se em constante evolução. Saliente-se, no entanto, que a BP Incorporadora se compromete a acompanhar as evoluções e implementar melhorias de segurança constantemente, desde que possíveis e razoáveis, além de sujeitar aqueles que utilizarem indevidamente tais informações às penalidades aplicáveis e demais medidas legais cabíveis.</p>
              </div>
            </div>

            {/* Seção 10 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">10. DIREITOS DOS TITULARES</h3>
              <div className="space-y-3 text-gray-700">
                <p>10.1. Você poderá solicitar à BP Incorporadora, de maneira gratuita, a qualquer momento, a confirmação da existência de tratamento de seus Dados Pessoais; o acesso aos seus Dados Pessoais; a correção dos dados que estejam incompletos ou desatualizados; a revogação do seu consentimento dado a esta Política; a eliminação dos dados cuja guarda não seja permitida e/ou determinada pela Lei Brasileira, além dos demais previstos na Lei Brasileira, quando cabível.</p>
                <p>10.2. Para que você possa exercer seus direitos, basta entrar em contato com a BP Incorporadora por meio do nosso Encarregado de Dados (DPO), conforme detalhado na Seção 12.</p>
                <p>10.3. A BP Incorporadora se reserva o direito de utilizar meios de autenticação dos Usuários no momento de suas solicitações, como forma de segurança e proteção a qualidade e integralidade das informações, evitando as chances de acessos aos seus Dados Pessoais por terceiros desautorizados e vazamentos ou roubos de dados.</p>
                <p>10.4. A BP Incorporadora empreenderá seus melhores esforços para responder às suas solicitações no menor tempo possível e de forma completa, clara e de acordo com as suas legítimas expectativas.</p>
                <p>10.5. Para receber informações sobre a BP Incorporadora, mantenha seu cadastro sempre atualizado. Caso ocorra alguma mudança nos Dados Pessoais fornecidos por você à BP Incorporadora, entre em contato conosco para realizar as devidas alterações ou acesse seu perfil de acesso, para garantir a qualidade de seus dados.</p>
                <p>10.6. Você fica ciente de que a exclusão das informações essenciais para gestão de sua conta junto à BP Incorporadora implicará no término de seu cadastro, com consequente cancelamento dos Serviços então prestados pela BP Incorporadora.</p>
              </div>
            </div>

            {/* Seção 11 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">11. RESPONSABILIDADES E BOAS PRÁTICAS DOS USUÁRIOS/CLIENTES</h3>
              <div className="space-y-3 text-gray-700">
                <p>11.1. Considerando que você será Usuário/Cliente do Website ou Portal do Cliente da BP Incorporadora através de um dispositivo pessoal com acesso à Internet, a segurança dos seus Dados Pessoais não depende exclusivamente da BP Incorporadora, de modo que Você também deverá estar atento à disponibilidade das suas informações, conforme nossas orientações.</p>
                <p>11.2. Para garantir o cuidado e a diligência com seus Dados Pessoais, você se compromete a:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>(i) Fornecer informações verdadeiras e manter suas informações pessoais atualizadas;</li>
                  <li>(ii) Proteger suas informações contra acessos não autorizados ao seu computador ou dispositivo móvel, contas e senhas;</li>
                  <li>(iii) Não compartilhar sua senha com terceiros e lembrar de atualizá-la com frequência;</li>
                  <li>(iv) Não compartilhar a usabilidade de sua conta com terceiros;</li>
                  <li>(v) Manter o programa antivírus e o sistema operacional do seu dispositivo atualizados;</li>
                  <li>(vi) Não permitir que o navegador salve automaticamente a sua senha;</li>
                  <li>(vii) Ao acessar por um dispositivo compartilhado, certificar-se de que encerrou sua sessão;</li>
                  <li>(viii) Ao usar a Internet em locais públicos, tomar cuidado para que pessoas próximas não possam ver seus dados;</li>
                  <li>(ix) Certificar-se de que está utilizando uma conexão segura.</li>
                </ul>
              </div>
            </div>

            {/* Seção 12 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">12. CENTRAL DE ATENDIMENTO E ENCARREGADO DE DADOS (DPO)</h3>
              <div className="space-y-3 text-gray-700">
                <p>12.1. Para dúvidas gerais, solicitações, reclamações ou elogios relacionados aos nossos Serviços, você poderá entrar em contato conosco através dos nossos Canais de Comunicação disponíveis no Website ou Portal do Cliente.</p>
                <p>12.2. Para exercer seus direitos de titular de dados previstos na LGPD (detalhados na Seção 10) ou para qualquer questão específica sobre o tratamento de seus dados pessoais, entre em contato com nosso Encarregado pelo Tratamento de Dados Pessoais (DPO) através do seguinte e-mail: <a href="mailto:privacidade@bpincorporadora.com.br" className="text-blue-600 hover:text-blue-800 underline">privacidade@bpincorporadora.com.br</a>.</p>
              </div>
            </div>

            {/* Seção 13 */}
            <div>
              <h3 className="text-2xl text-gray-900 mb-3">13. ATUALIZAÇÃO DE NOSSA POLÍTICA DE PRIVACIDADE</h3>
              <div className="space-y-3 text-gray-700">
                <p>13.1. A BP Incorporadora poderá realizar retificações e mudanças nesta Política de Privacidade sempre que houver necessidade. Neste caso, Você será notificado com antecedência razoável antes que as alterações se apliquem a Você – portanto, é muito importante manter seus dados de contato atualizados.</p>
                <p>13.2. Caso seja realizada alguma alteração em nossa Política, iremos divulgar a atualização em nossas Páginas, através de avisos. Também poderemos encaminhar comunicados ao seu e-mail, em conjunto com a versão mais atual da Política de Privacidade.</p>
                <p>13.3. Recomendamos que você visite periodicamente esta página para verificar eventuais mudanças.</p>
              </div>
            </div>
          </section>

          {/* Botão Voltar no final */}
          <div className="pt-6 border-t-2 border-gray-200">
            <Button
              onClick={onVoltar}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl shadow-lg transition-all duration-300 hover:scale-105"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar para Solicitação de Assistência
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
