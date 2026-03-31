---
name: my-project
description: >-
  Aplica convenções do projeto eon-connect-next: planejamento de arquivos,
  módulos back-end em /src/modules, estados de UI no front, testes de negócio,
  checagem de segurança e formato de resposta JSON da API. Use em qualquer
  feature nova, refatoração de API, telas, ou quando o usuário pedir alinhamento
  com os padrões do repositório.
---

# Eon Connect — convenções do projeto

## Quando aplicar

- Implementar ou alterar endpoints, serviços ou repositórios.
- Criar ou alterar telas, features ou hooks no front.
- Revisar entregas (segurança, testes, consistência com a estrutura de pastas).

## 1. Planejamento (obrigatório antes de codar)

Antes de criar ou modificar código, **liste explicitamente** os arquivos que serão:

- **Criados** (caminho completo sob `src/`).
- **Modificados** (caminho e motivo breve).

Se o escopo mudar, atualize a lista antes de continuar.

## 2. Back-end — estrutura por feature

Organize cada domínio em:

```
src/modules/{feature}/
  controller.ts
  service.ts
  repository.ts
  routes.ts
  dto.ts
```

- **Controller**: HTTP, status codes, delegação ao service.
- **Service**: regras de negócio (testáveis sem HTTP).
- **Repository**: acesso a dados (SQL com prepared statements / ORM parametrizado).
- **Routes**: registro de rotas e middlewares.
- **DTO**: validação e tipos de entrada/saída da feature.

Listagens: paginação padrão `limit=20`, `page=1` (ou o padrão já adotado no repo), salvo exceção documentada.

## 3. Resposta da API (sempre)

Todo endpoint REST deve retornar JSON neste formato:

```ts
{
  success: boolean;
  data: T | null;
  message: string;
  error: string | null;
}
```

- Em sucesso: `success: true`, `data` preenchido quando aplicável, `message` descritivo, `error: null`.
- Em falha: `success: false`, `data: null`, `message` e/ou `error` com informação segura para o cliente (sem stack trace ou detalhes internos em produção).

## 4. Front-end — estados obrigatórios

Toda tela ou bloco que depende de dados remotos deve implementar os **quatro estados**:

| Estado    | Comportamento esperado                          |
|-----------|--------------------------------------------------|
| loading   | Feedback visual de carregamento                |
| error     | Mensagem acessível + ação de retry quando fizer sentido |
| empty     | Estado vazio explicado (sem dados)               |
| success   | Conteúdo principal com dados                    |

**Pastas:**

- `src/components/ui` — primitivos reutilizáveis (botão, input, skeleton, etc.).
- `src/features/{domínio}` — composição por domínio.
- `src/hooks` — hooks compartilhados.
- `src/services` — chamadas HTTP/cliente de API.
- `src/stores` — estado global quando necessário.

Mobile-first, HTML semântico e critérios **WCAG 2.1 AA** quando houver UI nova ou alterada.

Para detalhes de breakpoints, skeleton, formulários e checklist de entrega do front, use `.cursor/skills/ux-designer/SKILL.md`.

## 5. Testes

- Pelo menos **um teste unitário por função de negócio** (tipicamente no **service** ou em funções puras extraídas dele).
- Nomes de teste descrevem comportamento esperado, não só o nome da função.

Para metodologia de QA (happy/sad path, API, componente, relatório com veredito), use `.cursor/skills/qa-tester/SKILL.md`.

## 6. Segurança (checklist antes de considerar pronto)

- [ ] Inputs validados e sanitizados (DTO + validação na borda).
- [ ] Nenhuma credencial, token ou chave em código; usar variáveis de ambiente.
- [ ] Queries parametrizadas; **nunca** concatenar SQL com input do usuário.
- [ ] Tokens de sessão preferencialmente em **cookies httpOnly**, não em `localStorage` (alinhado às regras do projeto).

## 7. Entrega — o que reportar ao finalizar

Ao concluir a tarefa, inclua na resposta:

1. **Feito**: lista objetiva do que foi implementado ou alterado (arquivos e comportamento).
2. **Ainda precisa ser testado**: cenários manuais, integração, E2E, ou ambientes não cobertos pelos testes adicionados.

---

## Idioma e estilo (alinhado às regras do repo)

- Comentários no código: **português (Brasil)**.
- Identificadores (variáveis, funções, classes): **inglês**.
- Commits: **Conventional Commits** em inglês (`feat`, `fix`, `chore`, `docs`, `refactor`).
