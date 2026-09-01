# Roadmap do CurupiraCode

Este documento organiza a evolução do CurupiraCode por marcos de produto, não por datas artificiais. Um marco
só é concluído quando seus critérios observáveis passam nos ambientes suportados.

## Visão

Construir um harness aberto, local e extensível que acompanhe o usuário no código, no navegador e nos
documentos, mantendo modelos, ferramentas, dados e permissões sob escolha explícita.

## Princípios

1. **Local primeiro.** O núcleo deve funcionar no computador do usuário e expor a rede apenas quando isso for
   configurado conscientemente.
2. **Tudo é plugin.** Navegador, Office, modelos, pesquisa e automações usam contratos substituíveis.
3. **Sem provedor obrigatório.** OpenRouter, APIs compatíveis, modelos locais e provedores comerciais podem
   coexistir.
4. **Permissão mínima.** Ler é diferente de agir; toda escrita externa relevante oferece prévia, confirmação e
   registro.
5. **Português do Brasil de primeira classe.** Outros idiomas são suportados sem transformar pt-BR em tradução
   secundária.
6. **Compatibilidade antes da troca de namespace.** Plugins `@deepseek-ai/dsh-*` continuam válidos durante uma
   migração documentada.

## Marco 0 — Interface consolidada

Status: **em andamento**.

Entregas atuais:

- [x] nome, favicon e wordmark CurupiraCode;
- [x] símbolo em forma de trilha/circuito com pegadas invertidas;
- [x] tema escuro local e experiência pt-BR;
- [x] onboarding com identidade e atribuição corretas;
- [x] comando `curupiracode`, preservando `dsh` como alias legado;
- [x] pesquisa DuckDuckGo + Google News integrada ao bundle padrão;
- [x] fallback orgânico para Bing inspirado pelo `dsh-free-web-search`;
- [x] provedor SearXNG portátil, configurável e sem instância pública fixada;
- [ ] revisar visualmente desktop, janela estreita e temas claro/escuro em navegador conectado;
- [ ] consolidar tokens de cor, tipografia, espaçamento e estados de foco em um pacote de design;
- [ ] eliminar textos públicos restantes da distribuição original sem renomear contratos internos;
- [ ] concluir auditoria WCAG 2.2 AA por teclado, contraste e leitor de tela.

Critério de saída: uma instalação limpa apresenta somente CurupiraCode nas superfícies públicas, inicia em
pt-BR, pesquisa sem chave e passa nos testes de interface e acessibilidade.

## Marco 1 — Distribuição aberta e reproduzível

- publicar o repositório CurupiraCode com histórico e atribuição preservados;
- criar pacotes para macOS, Linux e Windows com instalador e desinstalador verificáveis;
- publicar o binário `curupiracode` e manter o alias `dsh` por pelo menos uma versão principal;
- separar configuração, credenciais e sessões para permitir atualização sem perda de dados;
- documentar builds reproduzíveis, SBOM, hashes e política de vulnerabilidades;
- definir a migração assistida de `@deepseek-ai/dsh-*` para um namespace próprio.

Critério de saída: uma pessoa instala, atualiza e remove o CurupiraCode sem editar arquivos internos, e o build
publicado pode ser reproduzido a partir da tag correspondente.

## Marco 2 — Curupira Memória

Objetivo: oferecer um “segundo cérebro” local que aprende somente com materiais autorizados pelo usuário, mantém as fontes verificáveis e trabalha de forma autônoma dentro de limites explícitos.

Estado atual: o núcleo local já combina SQLite FTS5 com embeddings neurais multilíngues opcionais, encontra materiais relacionados e orienta o agente a consultar o cofre proativamente com proveniência. O modelo é baixado no primeiro uso, reutilizado offline e tem fallback lexical. A próxima etapa deste marco é consolidar a interface visual de notas, backlinks e grafo no estilo Obsidian.

### Arquitetura local e aberta

- criar um novo seam `ctx.knowledge`, sem ampliar artificialmente o `ctx.attachments` atual, que é especializado em imagens;
- armazenar originais de forma imutável e endereçada por conteúdo em `<CURUPIRA_HOME>/knowledge/v1`, com opção de usar uma pasta Markdown escolhida pelo usuário como cofre;
- extrair texto por plugins de formato para Markdown, TXT, HTML, PDF e DOCX; novos formatos entram sem alterar o núcleo;
- usar SQLite FTS5 como índice mínimo obrigatório, sem API, servidor ou banco vetorial externo;
- oferecer embeddings locais como melhoria opcional, mantendo busca lexical funcional quando nenhum modelo de embeddings estiver instalado;
- registrar origem, hash, página ou seção e intervalo de texto para toda passagem recuperada.

### Autonomia controlada

- após um upload autorizado, detectar tipo, deduplicar, extrair, dividir e indexar o material automaticamente;
- criar notas derivadas em Markdown com resumo, conceitos, perguntas e ligações entre fontes, sem modificar o arquivo original;
- reprocessar somente documentos alterados e manter fila local retomável após reinício;
- sugerir conexões e revisões periódicas, mas exigir confirmação para apagar, mover, compartilhar ou sobrescrever conteúdo;
- permitir pausar a indexação, limitar pastas, excluir documentos e reconstruir todo o índice a partir dos originais;
- responder sobre o acervo com citações navegáveis e distinguir claramente conteúdo da fonte, inferência do modelo e informação obtida na web.

### Privacidade e interoperabilidade

- o cofre e o índice permanecem locais por padrão, sem telemetria de conteúdo;
- sincronização é opcional e usa provedores substituíveis escolhidos pelo usuário;
- exportação usa Markdown, JSON e arquivos originais, evitando um formato proprietário sem saída;
- materiais recuperados são tratados como dados não confiáveis e não podem conceder permissões ao agente por instruções embutidas.

Critério de saída: uma instalação sem chaves importa arquivos reais, retoma indexações interrompidas, encontra trechos por busca local, gera notas derivadas rastreáveis e responde com citações exatas sem alterar os originais.

## Marco 3 — Extensão aberta para navegadores

Objetivo: oferecer um painel lateral semelhante à categoria de assistentes como Claude in Chrome, mas com
código aberto, backend selecionável e controle local.

Estado atual: **primeiro protótipo funcional para Chrome e Edge**. A extensão Manifest V3 oferece conversa
persistente com contexto opcional da página e um modo separado de automação. Ambos usam presets sem ferramentas
de sistema; somente a automação produz um plano JSON, mostra a prévia e executa ações aprovadas. A ponte aceita
somente o ID estável da extensão em loopback; streaming, pareamento por token efêmero, a variante Firefox e a
publicação nas lojas permanecem neste marco.

### Primeira versão

- [x] painel lateral persistente para Chrome e Edge usando Manifest V3 e
  [`chrome.sidePanel`](https://developer.chrome.com/docs/extensions/reference/api/sidePanel);
- [ ] variante Firefox usando `sidebar_action`, pois a própria
  [documentação da Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities#sidebar_api)
  registra que as APIs de sidebar do Firefox e Chrome são incompatíveis;
- [x] enviar título, URL, texto selecionado, conteúdo legível e controles da aba somente após gesto do usuário;
- [x] planejar e apresentar prévia para `click`, `fill`, `select`, `check` e `scroll`;
- [x] responder formulários com valores editáveis, aprovação por campo, confiança visível e envio sempre manual;
- [x] gravar e reproduzir macros sem código em formulários de várias etapas, com exportação e importação;
- [x] conversar, resumir e explicar com histórico restaurado diretamente no painel;
- [ ] comparar abas e extrair para tabela com resultados persistentes no painel;
- [ ] citações que retornam à página e ao trecho de origem;
- [ ] conexão autenticada com token efêmero e pareamento visível; o protótipo atual usa origem estável,
  loopback obrigatório e bloqueio separado dos RPCs privilegiados;
- [x] `activeTab` sem `<all_urls>`; a extensão solicita somente acesso HTTP a `127.0.0.1` e `localhost`.

### Ponte local

O painel conversa com um protocolo Curupira Bridge pequeno e versionado. A conexão HTTP/WebSocket local cobre
o uso comum. Recursos que realmente precisam acessar o sistema usam
[native messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging),
sempre como permissão opcional e com manifesto instalado pelo aplicativo local.

### Segurança

- separar leitura de página, navegação, clique e preenchimento em capacidades independentes;
- [x] mostrar domínio e ação antes de operações sensíveis;
- [x] bloquear envio silencioso de senha, cartão, token de autenticação e upload;
- manter log local exportável de ações do agente;
- testar páginas com prompt injection e conteúdo hostil antes do lançamento público.

Critério de saída: os mesmos testes de contrato passam em Chrome, Edge e Firefox, com diferenças de manifesto
isoladas e nenhuma permissão ampla obrigatória.

## Marco 4 — Ecossistema de agentes e compatibilidade Claude

Compatibilidade significa interoperar por contratos públicos, não copiar marca ou interface de terceiros.

- manter ACP como transporte de agentes externos;
- expor ferramentas selecionadas por MCP para clientes compatíveis;
- estabilizar o adaptador de subagente Claude Code já existente no código-base;
- fornecer um plugin CurupiraCode para Claude Code com skills, agentes, hooks e MCP, formatos oficialmente
  suportados pela [documentação de plugins](https://code.claude.com/docs/en/plugins);
- importar e exportar prompts, skills e configurações sem incluir credenciais;
- permitir handoff de uma tarefa entre Web, terminal e extensão de navegador com contexto mínimo explícito.

Critério de saída: uma tarefa pode sair do CurupiraCode, executar em um agente externo compatível e voltar com
resultado, eventos e permissões rastreáveis.

## Marco 5 — CurupiraCode para documentos e Office

As três famílias compartilham comandos e protocolo, mas cada uma usa a API nativa de seu editor.

### 5.1 ONLYOFFICE

Primeiro protótipo por ter uma superfície HTML/CSS/JavaScript próxima da interface existente. A plataforma
oferece [plugins com UI e APIs externas](https://api.onlyoffice.com/docs/plugins/get-started/) para documentos,
planilhas e apresentações.

- painel CurupiraCode nos três editores;
- resumir, revisar e reescrever seleção;
- transformar dados selecionados em tabela, fórmula ou explicação;
- criar roteiro e notas para apresentações;
- apresentar diff antes de inserir ou substituir conteúdo.

### 5.2 LibreOffice

- extensão `.oxt` aberta para Writer, Calc e Impress;
- ponte UNO fina, mantendo decisões de agente no processo CurupiraCode;
- funcionamento com modelos locais e sem conta obrigatória;
- publicação no repositório comunitário de extensões do LibreOffice.

### 5.3 Microsoft Office

- add-in para Word, Excel e PowerPoint usando Office.js;
- manifesto específico de add-in inicialmente, avaliando o manifesto unificado quando a matriz de suporte for
  suficiente; a Microsoft mantém
  [os dois formatos](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/add-in-manifests);
- hospedagem HTTPS para a distribuição, com modo de desenvolvimento apontando à ponte local;
- permissões declaradas por aplicativo e ação, sem gravação automática no documento.

Critério de saída: o mesmo conjunto básico de comandos funciona nos três ecossistemas e toda alteração de
documento tem prévia, confirmação, desfazer e teste com arquivos reais.

## Marco 6 — SDK e catálogo comunitário

- SDK estável para TypeScript e um template oficial de plugin;
- catálogo assinado com origem, licença, permissões e compatibilidade visíveis;
- instalação, atualização, desativação e rollback por plugin;
- análise estática de manifesto e dependências antes da publicação;
- selo “funciona localmente” para plugins sem dependência de nuvem.

Critério de saída: um terceiro cria, testa, publica e atualiza um plugin sem alterar o núcleo.

## Marco 7 — Versão 1.0

- contratos públicos versionados e política de depreciação;
- migração de namespace concluída com ferramenta automática;
- instalação reproduzível e assinada nas três plataformas de desktop;
- suíte de segurança para navegador, documentos, sandbox e plugins;
- governança comunitária, processo de release e responsáveis por segurança definidos.

## Fora de escopo até a base estabilizar

- serviço de nuvem obrigatório;
- marketplace fechado ou cobrança embutida no núcleo;
- automação irrestrita do navegador;
- edição silenciosa de documentos;
- cópia de identidade, marca ou fluxos proprietários de Claude, Microsoft ou outros produtos.
