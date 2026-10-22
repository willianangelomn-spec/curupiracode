<p align="center">
  <img src="apps/web/public/favicon.svg" width="96" alt="Marca do CurupiraCode" />
</p>

# CurupiraCode

Português do Brasil | [English](README.en.md) | [中文](README.zh.md)

**IA aberta, código sob seu controle.**

O CurupiraCode é um harness de agentes de IA local, aberto e orientado a plugins. É um derivado independente do [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), preserva a arquitetura combinável baseada no [Cordis](https://github.com/cordiverse/cordis) e acrescenta identidade brasileira, experiência em português e integrações que não prendem o usuário a um único provedor.

## Estado atual

- base sincronizada com o DeepSeek Harness 0.2 (`dsh-v0.2.1-rc.2`): API tipada entre interface e servidor, acesso à interface protegido por token, painel lateral direito, tarefas automáticas e gerenciador de plugins;
- identidade CurupiraCode como plugin de marca, com a paleta verde-floresta aplicada sobre qualquer tema;
- português do Brasil como pacote de idioma, escolhido automaticamente em navegadores em português;
- Google Gemini 4 Argon e os demais modelos Gemini pelo Antigravity CLI, sem chave de API;
- busca DuckDuckGo embutida com fallback Bing e Google News, sem chave adicional;
- suporte opcional a SearXNG por meio de uma instância open-source controlada pelo operador;
- extensão para Chrome e Edge com chat lateral, automação revisável, formulários assistidos e macros portáteis; a conexão da extensão com o servidor ainda precisa ser portada para o acesso autenticado do dsh 0.2 (veja [`apps/browser-extension`](apps/browser-extension/README.md));
- compatibilidade com plugins e perfis `@deepseek-ai/dsh-*` durante a transição;
- comandos `curupiracode` e `dsh`, com `dsh` mantido como alias legado.

O projeto está em prévia para desenvolvedores. APIs e formatos ainda podem mudar.

<a id="rodando"></a><a id="run"></a><a id="run-from-source"></a>

## Rodando deste checkout

Instale uma versão do Node.js compatível com o campo `engines` do [package.json](package.json), mais o pnpm.

```sh
pnpm install
pnpm run build
pnpm curupiracode web
```

O comando imprime um endereço como `http://127.0.0.1:3080/?token=…` e o abre no navegador. O token cria um cookie de sessão nesse navegador; depois disso, `http://127.0.0.1:3080` basta. Passe `--no-open` para iniciar sem abrir o navegador e abra o endereço impresso.

```sh
pnpm curupiracode web --no-open
```

Para usar o Google Gemini, instale o Antigravity CLI (`agy` 1.4.3 ou mais recente para o Gemini 4 Argon) e entre com sua conta Google em **Configurações → Modelos → Google Gemini → Entrar com Google**, ou rodando `agy` uma vez no terminal. O [README do adaptador](packages/llm/llm-gemini/README.md) descreve os modelos e as configurações.

<a id="o-que-tem-dentro"></a>

## O que tem dentro

**Núcleo de agente (host, composição Cordis)**

- Harness de agente local-first: toda capacidade é uma linha de plugin; o processo host compõe registros, persistência e serviços sem dependência de nuvem.
- Sessões com trajetória completa, conversas retomáveis, arquivamento e metas de conclusão na mesma sessão para objetivos longos.
- Subagentes em segundo plano, orquestração de workflows multiagente e loops iterativos com agentes novos.
- Modos de agente por sessão: padrão, mínimo, Criador (Cordis) e PTC, em que o agente chama ferramentas por código.
- Tarefas automáticas agendadas e trabalhos em segundo plano acompanhados pela interface.
- Seam de credenciais para segredos locais, além de fluxos de autorização OAuth.
- Sandbox de ferramentas com políticas de acesso a arquivos e pedidos de aprovação; o agente declara a permissão mínima que precisa.
- Plugins dinâmicos (`@pluginId`) e gerenciador de plugins: instalar, definir, executar, atualizar e reverter código host/cliente a partir da sessão em execução.

**Provedores de inteligência**

- Modelos oficiais DeepSeek, por chave de API ou por conta DeepSeek.
- Google Gemini por login de conta Google de consumidor — o adaptador conversa com o Antigravity CLI (`agy`) instalado e autenticado localmente, sem nenhuma chave de API para gerenciar; o catálogo começa pelo Gemini 4 Argon, e um transporte OAuth por conta Google (Code Assist) permanece como alternativa.
- OpenAI, Anthropic, Kimi e dezenas de outros provedores do catálogo integrado, além de qualquer endpoint compatível, com esforço de raciocínio por modelo, políticas de retry e seletor de modelos.

**Curupira Memória (segundo cérebro)**

- Pacote de conhecimento local: ingestão de documentos, fatiamento em passagens e busca com proveniência completa (documento, trecho e offset).
- Store SQLite no próprio computador, com vault endereçado por conteúdo — reingerir é barato e nunca duplica.
- Extração de **PDF**, **DOCX**, **HTML** e texto puro; pensado para ler direto o vault do seu Obsidian.
- Ferramentas prontas para o agente ingerir pastas, buscar nas suas anotações e encontrar materiais relacionados nos modos padrão, PTC e Criador.

**Web e conhecimento**

- Busca embutida sem chave extra: DuckDuckGo com fallback Bing e Google News; SearXNG opcional por instância própria do operador.
- Leitura de páginas por HTTP para o agente consultar o conteúdo dos resultados.

**Extensão para Chrome e Edge**

- Chat persistente no painel lateral, com inclusão opcional e limitada do conteúdo visível da página atual.
- Automação com plano validado e prévia editável: somente as ações aprovadas pelo usuário são executadas no navegador.
- Preenchimento assistido de formulários sem envio automático, bloqueando senhas, códigos de autenticação, cartões e uploads.
- Gravação e reprodução de macros portáteis entre páginas, armazenadas localmente e com parada obrigatória antes do envio final.
- Código-fonte, instruções de instalação e o estado da ponte com o servidor em `apps/browser-extension`.

**Interface web (cliente)**

- GUI local em `http://127.0.0.1:3080`, com português do Brasil como experiência principal, além de inglês e chinês.
- Painel lateral direito com os arquivos do trabalho, navegador embutido, terminal e prévia de documentos, incluindo PDF, planilhas e arquivos do Office.
- Página de Modelos com onboarding de provedores, cartões de chave de API e listagem ao vivo de provedores e modelos.
- Atalhos de teclado, exportação do registro da sessão, visualizações de conversa, tabelas de trajetória e medição de contexto.
- Identidade CurupiraCode e o tema comunitário opcional Cyberpunk Neon ([`ui-theme-cyberpunk`](packages/client/ui-theme-cyberpunk/README.md)).

**Linha de comando**

- `curupiracode web` (e modo headless), com `dsh` mantido como alias legado para scripts existentes.

## Direção do projeto

O [roadmap](ROADMAP.md) em português começa pela consolidação da interface e já inclui o Curupira Memória, uma camada local de segundo cérebro ancorada nos materiais do usuário, e a extensão de painel lateral para navegadores. A evolução segue com compatibilidade ampliada com ferramentas de agentes e extensões para ONLYOFFICE, LibreOffice e Microsoft Office. Veja [BRAND.md](BRAND.md) para a identidade visual e as regras de uso.

## Compatibilidade e origem

Os namespaces internos seguem `@deepseek-ai/dsh-*` nesta fase, para que o ecossistema existente continue carregando sem migração destrutiva. Uma mudança futura para um namespace próprio do projeto virá com ferramentas e uma janela de compatibilidade. Veja [NOTICE.md](NOTICE.md) para a atribuição e a independência do projeto.

## Contribuir

Leia [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md) e a [documentação de arquitetura](docs/architecture.md). Novas integrações devem ser plugins, pedir as permissões mínimas e manter o usuário no controle das ações externas.

## Citação

O CurupiraCode deriva do DeepSeek Harness; para citar a arquitetura de origem:

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## Licença

[MIT](LICENSE). Dependências de terceiros e suas licenças estão listadas em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
