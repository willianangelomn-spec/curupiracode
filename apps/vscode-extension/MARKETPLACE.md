# CurupiraCode para VS Code

Converse com o agente local do **CurupiraCode** sobre o projeto aberto, sem sair do VS Code — inclusive com o **Gemini 4 Argon** pelo Antigravity CLI.

## Requisitos

1. O CurupiraCode clonado e compilado no seu computador:

   ```sh
   git clone https://github.com/willianangelomn-spec/curupiracode.git ~/curupiracode
   cd ~/curupiracode
   pnpm install && pnpm run build
   ```

2. Node.js 22.19 ou mais recente.
3. Para os modelos Gemini: o Antigravity CLI (`agy`) instalado e conectado à sua conta Google (rode `agy` uma vez no terminal, ou use **Configurações → Modelos → Google Gemini → Entrar com Google** na interface web do CurupiraCode).

## Uso

- Abra a pasta do seu projeto e clique no ícone do CurupiraCode na barra de atividades.
- Escolha o modelo no topo do painel (padrão: Gemini 4 Argon Low) e escreva a pergunta.
- Com **Incluir arquivo ou seleção do editor** marcado, o código do editor ativo vai junto com a pergunta. Os modelos servidos pelo Antigravity não leem arquivos sozinhos, então use essa opção para perguntar sobre código.
- Clique com o botão direito numa seleção e escolha **CurupiraCode: Perguntar sobre a seleção**.
- **Nova** começa outra conversa; **Web** abre a interface completa (`pnpm curupiracode web`) no navegador.

## Configurações

| Configuração | Padrão | Uso |
|---|---|---|
| `curupiracode.model` | `gemini/gemini-4-argon-low` | Modelo no formato `provedor/modelo`. |
| `curupiracode.installPath` | vazio | Pasta do CurupiraCode compilado; vazio procura a pasta aberta e `~/curupiracode`. |
| `curupiracode.nodePath` | vazio | Node.js que roda o CurupiraCode; vazio usa o `node` do seu terminal. |
| `curupiracode.webUrl` | `http://127.0.0.1:3080` | Endereço da interface completa. |

## Limitações

- O painel não pede aprovação de ações: o CurupiraCode roda no modo de automação, que só escreve dentro da pasta aberta e recusa o que exigiria confirmação.
- **Parar** encerra o processo do CurupiraCode; a conversa continua na próxima mensagem.
- O histórico de uma conversa retomada depois de reiniciar o VS Code não é reexibido no painel, mas o modelo continua com o contexto.
