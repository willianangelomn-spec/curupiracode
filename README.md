<p align="center">
  <img src="apps/web/public/favicon.svg" width="96" alt="Marca do CurupiraCode" />
</p>

# CurupiraCode

Português | [English](README.en.md) | [中文](README.zh.md)

**IA aberta, código sob seu controle.**

O CurupiraCode é um harness de agentes de IA local, aberto e orientado a plugins. É um derivado independente do [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), preserva a arquitetura combinável baseada no [Cordis](https://github.com/cordiverse/cordis) e acrescenta identidade brasileira, experiência em português e integrações que não prendem o usuário a um único provedor.

## Estado atual

- Interface web com a identidade e o tema locais do CurupiraCode;
- Português do Brasil como experiência principal do produto;
- busca DuckDuckGo embutida com fallback Bing e Google News, sem chave adicional;
- suporte opcional a SearXNG por meio de uma instância open-source controlada pelo operador;
- compatibilidade com plugins e perfis `@deepseek-ai/dsh-*` durante a transição;
- comandos `curupiracode` e `dsh`, com `dsh` mantido como alias legado.

O projeto está em prévia para desenvolvedores. APIs e formatos ainda podem mudar.

<a id="o-que-tem-dentro"></a>

## O que tem dentro

**Núcleo de agente (host, composição Cordis)**

- Harness de agente local-first: toda capacidade é uma linha de plugin; o processo host compõe registros, persistência e serviços sem dependência de nuvem.
- Sessões com trajetória completa, conversas retomáveis e metas de conclusão na mesma sessão para objetivos longos.
- Subagentes em segundo plano, orquestração de workflows multiagente e loops iterativos com agentes novos.
- Seam de credenciais para segredos locais, além de fluxos de autorização OAuth iniciados direto da UI.
- Sandbox de ferramentas com políticas de acesso a arquivos e pedidos de aprovação; o agente declara a permissão mínima que precisa.
- Plugins dinâmicos (`@pluginId`): definir, executar, atualizar e reverter código host/cliente estendido a quente, a partir da sessão em execução.

**Provedores de inteligência**

- Modelos oficiais DeepSeek de fábrica.
- Google Gemini por login de conta Google de consumidor — o adaptador conversa com o Antigravity CLI (`agy`) instalado e autenticado localmente, sem nenhuma chave de API para gerenciar; um transporte OAuth por conta Google (Code Assist) permanece como alternativa para implantações corporativas.
- Qualquer endpoint compatível com OpenAI pelo provedor genérico, com esforço de raciocínio por modelo, políticas de retry e seletor de modelos.

**Curupira Memória (segundo cérebro)**

- Pacote de conhecimento local: ingestão de documentos, fatiamento em passagens e busca com proveniência completa (documento, trecho e offset).
- Store SQLite no próprio computador, com vault endereçado por conteúdo — reingerir é barato e nunca duplica.
- Extração de **PDF**, **DOCX**, **HTML** e texto puro; pensado para ler direto o vault do seu Obsidian.
- Ferramentas prontas para o agente ingerir pastas e buscar nas suas anotações assim que instalado.

**Web e conhecimento**

- Busca embutida sem chave extra: DuckDuckGo com fallback Bing e Google News; SearXNG opcional por instância própria do operador.

**Interface web (cliente)**

- GUI local em `http://127.0.0.1:3080`, com português do Brasil como experiência principal, além de inglês e chinês.
- Página de Modelos com onboarding de provedores, cartões de chave de API e de login que pesquisam até confirmar a conexão, e listagem ao vivo de provedores/modelos.
- Identidade e tema oficial CurupiraCode, além do tema comunitário Cyberpunk Neon; visualizações de conversa, tabelas de trajetória e medição de contexto.

**Linha de comando**

- `curupiracode web` (e modo headless), com `dsh` mantido como alias legado para scripts existentes.

<a id="rodando"></a>

## Rodando deste checkout

Instale uma versão do Node.js compatível com o campo `engines` do [package.json](package.json), mais o pnpm.

```sh
pnpm install
pnpm run build
pnpm curupiracode web
```

A UI abre em `http://127.0.0.1:3080`. Passe `--no-open` para iniciar sem abrir o navegador.

```sh
pnpm curupiracode web --no-open
```

## Direção do projeto

O [roadmap](ROADMAP.md) em português começa pela consolidação da interface e segue para o Curupira Memória, uma camada local de segundo cérebro ancorada nos materiais do usuário, uma extensão de painel lateral para o navegador, compatibilidade com ferramentas de agentes e extensões para ONLYOFFICE, LibreOffice e Microsoft Office. Veja [BRAND.md](BRAND.md) para a identidade visual e as regras de uso.

## Compatibilidade e origem

Os namespaces internos seguem `@deepseek-ai/dsh-*` nesta fase, para que o ecossistema existente continue carregando sem migração destrutiva. Uma mudança futura para um namespace próprio do projeto virá com ferramentas e uma janela de compatibilidade. Veja [NOTICE.md](NOTICE.md) para a atribuição e a independência do projeto.

## Contribuir

Leia [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md) e a [documentação de arquitetura](docs/architecture.md). Novas integrações devem ser plugins, pedir as permissões mínimas e manter o usuário no controle das ações externas.

## Licença

[MIT](LICENSE). Dependências de terceiros e suas licenças estão listadas em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
