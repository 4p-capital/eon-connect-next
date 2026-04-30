# Eon Connect — Módulos de Migração para a OctaBuild

**Escopo:** Assistência Técnica e Entrega de Chaves
**Versão:** 1.0 — Abril/2026
**Stack atual:** Next.js (App Router) + Supabase (Postgres + Edge Functions em Hono/Deno) + Storage + pg_cron + integrações externas

---

## 1. Visão Geral

O **Eon Connect** é a plataforma operacional da BP Incorporadora que conecta os setores internos (Contratos, Financeiro, Engenharia, Pós-venda, Assistência) ao cliente durante toda a jornada pós-venda. Ele centraliza fluxos que antes estavam espalhados em planilhas, WhatsApp pessoal e sistemas desconectados.

Este documento descreve apenas os **dois módulos que serão migrados para o ERP OctaBuild**:

1. **Assistência Técnica** — gestão de chamados de reparos pós-obra, com termo digital assinado e devolução de PDF para o ERP.
2. **Entrega de Chaves** — fluxo completo de entrega de unidades novas (Gran Santorini), com triagem de pendências, agendamento público, vistoria presencial e assinatura digital.

Ambos compartilham a mesma base técnica (Postgres no Supabase, Edge Functions em Hono, autenticação via Supabase Auth), mas operam em tabelas e fluxos independentes.

---

## 2. Integrações Externas (glossário)

| Integração | Uso no Eon Connect |
|---|---|
| **Sienge** | ERP atual da BP (CRM de clientes, contratos, anexos de documentos por unidade). O Eon Connect lê dados de cliente e devolve PDFs assinados. |
| **Clicksign** | Plataforma de assinatura eletrônica. Geração de envelope, link de assinatura, webhook de confirmação, download do PDF assinado. |
| **Z-API** | Gateway WhatsApp não-oficial (envia link de assinatura, link de NPS, QR Code de agendamento). |
| **ManyChat** | Plataforma de mensageria automatizada (campanhas WhatsApp). Usado para notificar clientes com pendências de entrega. |
| **OpenAI (GPT-4o-mini)** | Análise automática de risco do chamado de assistência (Moderado / Médio / Crítico) com base na descrição + categoria. |
| **n8n** | Automações externas (popular `id_manychat`, sincronizar dados). Não roda dentro do Eon Connect, mas alimenta o banco. |
| **Supabase Realtime** | Atualização em tempo real de calendários e listas (sem polling). |
| **pg_cron + pg_net** | Agendamento de jobs no Postgres que disparam HTTP para Edge Functions. |

---

## 3. Módulo: Assistência Técnica

### 3.1 Propósito

Gerenciar chamados de reparos pós-obra dos clientes BP. Cliente abre solicitação (foto + descrição) → equipe técnica vistoria e repara → cliente assina termo digital de aceite → PDF assinado é anexado no Sienge na unidade correta → cliente avalia o serviço (NPS).

### 3.2 Atores

| Ator | Interação principal |
|---|---|
| **Cliente final** | Abre app público, identifica-se por CPF, descreve problema com foto, recebe link de assinatura por WhatsApp, assina, avalia (NPS). |
| **Equipe BP (técnicos / gestores)** | Trabalha em painel Kanban: agenda vistoria → agenda reparo → finaliza com fotos e materiais → envia para assinatura. |
| **Síndico** | Visualiza assistências do empreendimento (acesso opcional). |
| **OpenAI (GPT)** | Classifica risco automaticamente quando o chamado é aberto. |
| **Clicksign** | Gera envelope, coleta assinatura, dispara webhook. |
| **Sienge** | Recebe o PDF assinado e o anexa no contrato/unidade do cliente. |

### 3.3 Fluxo narrativo

> O cliente abre o app público de Assistência Técnica e digita o CPF. O backend valida o CPF (mod-11) e busca em `clientes`; se não existir, cria. O cliente aceita os termos de privacidade, escolhe o empreendimento (lista vinda do Sienge), descreve o problema, anexa uma foto obrigatória e envia.
>
> Ao chegar no servidor, a solicitação é gravada em `Assistência Técnica` (sim, esse é o nome literal da tabela, com espaço e acento). De forma assíncrona, a Edge Function chama a **API da OpenAI** para classificar o risco (Moderado/Médio/Crítico) e grava em `gpt_analises`. Em paralelo, a Z-API envia notificação para o grupo técnico no WhatsApp.
>
> A equipe técnica entra no painel `/gerenciamento-assistencia`, vê o chamado no Kanban (coluna "Abertos"), agenda uma data de vistoria. Após a vistoria, agenda o reparo. No dia do reparo, o técnico finaliza: registra os responsáveis, materiais usados (`assistencia_finalizada_itens`), tira foto do reparo concluído. Isso cria o registro em `assistencia_finalizada`.
>
> Quando finalizado, o sistema gera um termo PDF a partir de um template HTML, faz upload para o **Storage** (`make-a8708d5d-termos-assistencia`) e cria um envelope no **Clicksign** com o cliente como signatário. O cliente recebe pelo WhatsApp (Z-API) o link de assinatura: "Assine seu Termo de Encerramento". O envelope é rastreado em `clicksign_envelopes`.
>
> Cliente assina → Clicksign dispara o webhook `document_closed` no Eon Connect → o sistema baixa o PDF assinado, salva no Storage e envia para o **Sienge** via API: localiza o cliente por CPF, encontra o contrato da unidade e anexa o PDF como documento customizado. O termo passa a ter `enviado_sienge=true`.
>
> Em seguida, é gerado um link de NPS (token único) que é enviado ao cliente também por WhatsApp. O cliente avalia de 1 a 10 e a resposta vai para `avaliacoes_nps`.
>
> **Cenário de aceitação tácita:** se o cliente não assina dentro de 7 dias, o webhook `deadline` do Clicksign dispara, o termo é marcado como `tipo_finalizacao='vencida'` (com carimbo de aceite tácito no PDF) e segue o mesmo fluxo de envio para o Sienge.

### 3.4 Modelo de dados — tabelas core

| Tabela | Função |
|---|---|
| `Assistência Técnica` | Solicitação principal (chamado). Status: `Abertos`, `Vistoria agendada`, `Reparo agendado`, `Aguardando assinatura`, `Finalizado`. |
| `clientes` | Cadastro de proprietários (CPF, nome, telefone, email, bloco, unidade, empreendimento, síndico). |
| `empreendimentos` | Catálogo de empreendimentos. |
| `sindicos` | Cadastro de síndicos. |
| `gpt_analises` | Análise GPT do chamado (classificação + texto). |
| `assistencia_finalizada` | Finalização do chamado: responsáveis, providências, foto do reparo, NPS, status final. |
| `assistencia_finalizada_itens` | Materiais utilizados no reparo (item, quantidade, unidade). |
| `materiais_reparo_pos_obra` / `materiais` | Catálogo de materiais. |
| `itens_utilizados_posobra` | Histórico agregado de uso de materiais por finalização. |
| `termos_assistencia` | Metadados do termo PDF: paths no Storage (pré-assinado, assinado, vencido), status de envio para Sienge, tipo de finalização. |
| `clicksign_envelopes` | Rastreamento do envelope Clicksign: status, signing_url, signed_document_url, datas de envio/assinatura. |
| `avaliacoes_nps` | Pesquisa de satisfação (token único, nota, comentário). |
| `whats_contacts` / `whats_conversations` / `whats_messages` | Histórico de conversas WhatsApp vinculadas ao chamado. |
| `User` / `Empresa` / `Centro_Custo` | Cadastros internos da BP (operadores, empresas e centros de custo). |

### 3.5 Relações principais

```
clientes (1) ──< Assistência Técnica (1) ──< assistencia_finalizada (1) ──< assistencia_finalizada_itens
                       │                              │
                       ├──< gpt_analises              ├──< termos_assistencia
                       └──< whats_conversations       ├──< clicksign_envelopes
                                                      ├──< avaliacoes_nps
                                                      └──< itens_utilizados_posobra
```

### 3.6 Integrações por ponto do fluxo

| Momento | Integração | O que acontece |
|---|---|---|
| Cliente submete solicitação | OpenAI | Análise assíncrona (classificação de risco) |
| Cliente submete solicitação | Z-API | Notificação para grupo técnico no WhatsApp |
| Finalização gera termo | Clicksign | Cria envelope + signatário; recebe `signing_url` |
| Termo precisa ser assinado | Z-API | Envia link de assinatura ao cliente |
| Cliente assina | Clicksign (webhook `document_closed`) | Sistema baixa PDF assinado |
| PDF assinado pronto | Sienge | Anexa PDF no contrato/unidade do cliente |
| Após assinatura | Z-API | Envia link de NPS ao cliente |
| 7 dias sem assinar | Clicksign (webhook `deadline`) | Aceitação tácita; PDF "vencido" segue para Sienge |

### 3.7 Storage buckets

| Bucket | Conteúdo |
|---|---|
| `make-a8708d5d-termos-assistencia` | PDFs do termo (pré-assinado, assinado, vencido). Estrutura: `finalizacao-{id}/...` |

---

## 4. Módulo: Entrega de Chaves (Gran Santorini)

### 4.1 Propósito

Orquestrar todo o ciclo de entrega de uma unidade nova ao cliente. Dividido em **três submódulos sequenciais** que dependem uns dos outros:

1. **Triagem de Pendências** — antes de poder agendar, o cliente precisa estar OK com Contratos (AGEHAB) e Financeiro (Pró-Soluto + Juros Obra). Equipes internas marcam o status linha a linha.
2. **Agendamento Público** — cliente entra em `/agendar`, valida CPF, escolhe um dia/período, recebe ticket com QR Code via WhatsApp.
3. **Recebimento Presencial** — no dia, operador BP usa tablet para escanear QR, conferir documentos, conduzir vistoria item a item, finalizar com parecer e capturar assinatura digital.

Notificações automáticas via ManyChat avisam clientes com pendências em aberto, todos os dias úteis.

### 4.2 Atores

| Ator | Função |
|---|---|
| **Equipe Contratos** | Marca status AGEHAB (OK / Pendência) por cliente. Carimba `verificado_agehab_em`. |
| **Equipe Financeiro** | Marca status Pró-Soluto e Juros Obra (OK / Pendência). Carimba `verificado_financeiro_em`. |
| **Cliente final** | Tela pública, sem login, usa CPF. Recebe ticket no WhatsApp. No dia, comparece e assina. |
| **Engenheiro / Operador BP** | Conduz a vistoria com tablet: escaneia QR, valida docs, marca itens (apto / não apto), finaliza vistoria. |

### 4.3 Fluxo narrativo

#### Submódulo 1 — Triagem de Pendências

> A equipe Contratos abre o painel admin (Eon Connect → Entregas → Pendências). A tabela lista todos os clientes da `clientes_entrega_santorini`. Cada linha tem três pendências: AGEHAB, Pró-Soluto, Juros Obra.
>
> Cada pendência tem **três estados**: cinza (não verificado), verde (verificado, sem pendência) ou laranja (verificado, com pendência). Quando o operador clica em qualquer botão, o backend grava o estado e carimba o timestamp `verificado_*_em` do setor (AGEHAB usa `verificado_agehab_em`, Pró-Soluto e Juros Obra compartilham `verificado_financeiro_em` porque é a mesma equipe).
>
> Toda manhã útil, às 10:00 (horário de Brasília), o **pg_cron** dispara a Edge Function `manychat-notificacoes-pendencias`. A função consulta a RPC `manychat_eligible_clients` (cadência de 10 dias por cliente), separa por campanha (Documental/AGEHAB ou Financeiro) e dispara via API do **ManyChat** o template correto. Cada disparo é registrado em `notificacoes_manychat_log` com `batch_id` único por execução, para auditoria por dia.

#### Submódulo 2 — Agendamento Público

> O cliente acessa `/agendar` (rota pública, sem login). Digita o CPF no validador (componente `CpfValidator` reaproveitado do módulo de Assistência — slots de dígitos, validação mod-11, feedback animado).
>
> O backend (`POST /entregas/validar-cpf`) busca o CPF em `clientes_entrega_santorini`. Se o cliente tem alguma pendência ativa, retorna a tela de bloqueio listando o que falta resolver. Senão, libera o calendário.
>
> O calendário (`GET /entregas/disponibilidade`) carrega os próximos 90 dias. Cada dia mostra vagas disponíveis em verde, lotados em cinza, e atualiza em **tempo real via Supabase Realtime** quando outro cliente reserva. O cliente escolhe um dia, vê os horários disponíveis e clica em um slot livre.
>
> A reserva (`POST /entregas/reservar`) faz um UPDATE atômico em `entrega_slot` (com `WHERE reserva_cliente_id IS NULL` — serializa concorrência sem locks). Se OK, o cliente confirma (`POST /entregas/confirmar`), o sistema gera um `checkin_token` UUID único e envia via **Z-API** uma imagem com QR Code para o WhatsApp do cliente. O cliente vê na tela um ticket visual com o mesmo QR.

#### Submódulo 3 — Recebimento Presencial

> No dia da entrega, o operador BP abre o app de Recebimento no tablet. O cliente apresenta o QR Code (via WhatsApp ou ticket). A câmera do tablet escaneia o QR, extrai o `checkin_token` e chama `GET /entregas/checkin/:token`. O backend marca `token_usado_checkin_em` e retorna os dados do cliente, slot e vistoria.
>
> A tela de vistoria tem **3 etapas (stepper)**:
>
> **Etapa 1 — Documentos:** operador faz upload da identidade do cliente (obrigatório) e, se aplicável, procuração e documento do proprietário. Os arquivos vão para o Storage `entrega-recebimento`. A vistoria avança de `aguardando_docs` → `docs_validados`.
>
> **Etapa 2 — Checklist item a item:** o sistema carregou um snapshot do catálogo `vistoria_item_template` para a `vistoria_entrega_item`. Para cada item (ex: "Estado das paredes do quarto", "Funcionamento da fechadura"), o operador tira foto (obrigatória), marca aceito = `true` ou `false`, e adiciona observação. Cada confirmação faz `POST /entregas/vistoria/:id/item`.
>
> **Etapa 3 — Parecer e assinatura:** após todos os itens validados, o operador clica "Finalizar Vistoria" e escolhe parecer: `apto` (cliente aceita as chaves) ou `nao_apto` (cliente rejeita; é reagendado pela fase 1). Se `apto`, o cliente escaneia o **mesmo QR** para iniciar a assinatura (`/entregas/assinar/:token`). A integração com **Clicksign** para coletar a assinatura digital do termo de recebimento ainda está em backlog — hoje, o sistema apenas marca `termo_assinado_em` e queima o token (`token_usado_assinatura_em`).
>
> Após o recebimento, há ganchos para pesquisa de satisfação e exportação de relatórios (admin), também em backlog.

### 4.4 Modelo de dados — tabelas core

| Tabela | Função |
|---|---|
| `clientes_entrega_santorini` | Núcleo do módulo. Cliente da entrega (separado de `clientes` da Assistência). Contém pendências (`pendencia_agehab`, `pendencia_prosoluto`, `pendencia_jurosobra`) e timestamps de verificação por setor (`verificado_agehab_em`, `verificado_financeiro_em`). Também guarda `id_manychat` (subscriber ID populado via n8n) e `agendado_em`. |
| `entrega_periodo_config` | Configuração dos horários disponíveis por empreendimento e tipo de dia (semana / sábado / domingo). Define hora_inicio, hora_fim, capacidade. |
| `entrega_slot` | Slot individual (uma vaga). Ao ser reservado, recebe `reserva_cliente_id` e gera `checkin_token` UUID único. UPDATE atômico no `reserva_cliente_id IS NULL` resolve concorrência. |
| `vistoria_entrega` | Vistoria do cliente no dia. Máquina de estados: `aguardando_docs` → `docs_validados` → `vistoria_em_andamento` → `finalizada_apto` ou `finalizada_nao_apto` → `termo_assinado`. Guarda paths dos documentos, parecer, engenheiro responsável e timestamps de cada transição. |
| `vistoria_entrega_item` | Item da vistoria (snapshot). Contém aceito (sim/não), observação, foto. |
| `vistoria_item_template` | Catálogo de itens do checklist (por empreendimento). Snapshot é copiado para `vistoria_entrega_item` quando a vistoria é criada — alterações no template não afetam vistorias antigas. |
| `notificacoes_manychat_log` | Histórico de notificações ManyChat. Agrupado por `batch_id` (uma execução do cron = um batch). Status `success` / `failed`, com a resposta da API e mensagem de erro quando falha. |

### 4.5 Relações principais

```
clientes_entrega_santorini (1) ──< entrega_slot (1) ──< vistoria_entrega (1) ──< vistoria_entrega_item
                │                                              │
                │                                              └── User (engenheiro_user_id)
                │
                ├──< notificacoes_manychat_log
                │
                └── id_manychat (text — populado via n8n)

entrega_periodo_config — (gerador de slots; sem FK direta)

vistoria_item_template (1) ──< vistoria_entrega_item (template_id, snapshot)
```

### 4.6 Integrações por ponto do fluxo

| Momento | Integração | O que acontece |
|---|---|---|
| Diariamente seg–sex 10:00 BRT | pg_cron + ManyChat | Dispara notificações para clientes com pendência ativa, respeitando cadência de 10 dias |
| Dados de subscriber ID | n8n | Popula `id_manychat` em `clientes_entrega_santorini` |
| Cliente confirma agendamento | Z-API | Envia QR Code + link via WhatsApp |
| Calendário em tela pública | Supabase Realtime | Atualiza vagas em tempo real |
| Cliente assina termo | Clicksign | Em backlog — fluxo de envelope + webhook ainda não implementado em produção |

### 4.7 Storage buckets

| Bucket | Conteúdo |
|---|---|
| `entrega-recebimento` | Documentos da vistoria (`{vistoria_id}/docs/...`) e fotos dos itens (`{vistoria_id}/itens/...`) |

### 4.8 Automação agendada (pg_cron)

| Job | Schedule | Função |
|---|---|---|
| `manychat-pendencias-notificacoes` | `0 13 * * 1-5` (13:00 UTC = 10:00 BRT, seg–sex) | Chama `manychat-notificacoes-pendencias` Edge Function via `pg_net.http_post`. Primeiro disparo real: 30/04/2026 (guard de data dentro do SQL). |

A Edge Function consulta a RPC `manychat_eligible_clients(cadencia_dias=10, batch_limit=100)` para selecionar candidatos. Regra de cadência: cliente só recebe se a última notificação bem-sucedida foi há mais de 10 dias (ou nunca recebeu).

---

## 5. Anexo — Mapa rápido de endpoints

### Assistência Técnica (em `/make-server-a8708d5d/`)

| Endpoint | Função |
|---|---|
| `POST /solicitacao-assistencia-v2` | Criar solicitação |
| `GET /assistencia` / `GET /assistencia/:id` | Listar / detalhar |
| `PATCH /assistencia/:id/status` | Atualizar status |
| `PATCH /assistencia/:id/data` | Agendar vistoria/reparo |
| `POST /assistencia-finalizada/:id` | Criar finalização |
| `GET /assistencia-finalizada/:id/termo-pdf` | Gerar PDF do termo |
| `POST /assistencia-finalizada/:id/enviar-sienge` | Anexar no Sienge |
| `GET /termos-assistencia` | Listar termos |

### Clicksign (Edge Function dedicada `/clicksign/`)

| Endpoint | Função |
|---|---|
| `POST /clicksign/send-envelope` | Cria envelope + envia link via Z-API |
| `POST /clicksign/webhook` | Recebe eventos `document_closed` / `deadline` / etc |
| `POST /clicksign/resend` | Reenvia link de assinatura |

### Entrega de Chaves (em `/make-server-a8708d5d/entregas/`)

| Endpoint | Função |
|---|---|
| `POST /entregas/validar-cpf` | Valida CPF + gate de pendências |
| `GET /entregas/disponibilidade` | Calendário com vagas |
| `POST /entregas/reservar` | UPDATE atômico em entrega_slot |
| `POST /entregas/confirmar` | Gera checkin_token + envia QR via Z-API |
| `POST /entregas/cancelar` / `/remarcar` | Operações de gestão da reserva |
| `GET /entregas/checkin/:token` | Lê QR e marca check-in |
| `POST /entregas/vistoria/criar` | Cria vistoria com snapshot dos itens |
| `POST /entregas/vistoria/:id/upload-doc` | Upload identidade/procuração |
| `POST /entregas/vistoria/:id/iniciar` | Transição → vistoria_em_andamento |
| `POST /entregas/vistoria/:id/item` | Salva foto + aceito/observação por item |
| `POST /entregas/vistoria/:id/finalizar` | Parecer apto/não apto |
| `GET /entregas/assinar/:token` | Inicia fluxo de assinatura (Clicksign — em backlog) |
| `POST /entregas/pendencias/toggle` | Marca pendência + carimba verificado_em |

### ManyChat (Edge Function dedicada `manychat-notificacoes-pendencias`)

| Endpoint | Função |
|---|---|
| `POST /` | Disparo do cron (consulta RPC, envia para ManyChat, grava log) |

---

**Fim do documento.**
