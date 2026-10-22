/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-sidebar-documentpreview`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'

/** `sidebarCodePreview` namespace, complete against its owning key set. */
export const sidebarCodePreviewPtBr = {
  title: 'Código',
  copy: 'Copiar',
  copied: 'Copiado',
} satisfies LocaleDictOf<'sidebarCodePreview'>

/** `sidebarExcel` namespace, complete against its owning key set. */
export const sidebarExcelPtBr = {
  title: 'Planilha',
  language: 'pt-BR',
  loading: 'Renderizando documento...',
  invalid: 'Não foi possível abrir esta planilha. Verifique o formato, o conteúdo ou a proteção por senha.',
  tooLarge: 'Esta pasta de trabalho excede o limite de tamanho da prévia.',
  timeout: 'A abertura desta pasta de trabalho excedeu o tempo limite. Tente um arquivo menor.',
  encoding: 'Não foi possível ler esta codificação de texto. Salve o arquivo como UTF-8 ou UTF-16 com BOM e tente novamente.',
  formulaWarning: 'Esta pasta de trabalho contém fórmulas. Os resultados exibidos podem estar ausentes ou imprecisos.',
  unsupportedNotice: 'Esta prévia não suporta {features} nesta pasta de trabalho. Abra-a em um aplicativo do sistema para a experiência completa.',
  charts: 'gráficos',
  images: 'imagens',
  shapes: 'formas',
  conditionalFormatting: 'formatação condicional',
  featureSeparator: ', ',
  retry: 'Tentar novamente',
} satisfies LocaleDictOf<'sidebarExcel'>

/** `documentHtml` namespace, complete against its owning key set. */
export const documentHtmlPtBr = {
  title: 'HTML',
  frame: 'Prévia do documento HTML',
  loading: 'Renderizando documento...',
  failed: 'Não foi possível exibir a prévia deste documento HTML.',
} satisfies LocaleDictOf<'documentHtml'>

/** `sidebarImage` namespace, complete against its owning key set. */
export const sidebarImagePtBr = {
  title: 'Imagem',
  preview: 'Prévia da imagem: {name}',
  loading: 'Renderizando documento...',
  failed: 'Não foi possível exibir esta imagem.',
  unsupported: 'A prévia de imagem exige o conteúdo completo do arquivo.',
} satisfies LocaleDictOf<'sidebarImage'>

/** `sidebarDocumentPreview` namespace, complete against its owning key set. */
export const sidebarDocumentPreviewPtBr = {
  loading: 'Renderizando documento...',
  loadMore: 'Carregar mais',
  changed: 'O arquivo mudou; exibindo o conteúdo anterior.',
  reloadNow: 'Recarregar',
  reload: 'Ler o arquivo novamente',
  autoRefresh: 'Atualização automática',
  'autoRefresh.enable': 'Ativar atualização automática',
  'autoRefresh.disable': 'Desativar atualização automática',
  'wrap.enable': 'Ativar quebra de linha',
  'wrap.disable': 'Desativar quebra de linha',
  'wrap.aria': 'Quebra de linha',
  openWith: 'Abrir com',
  'viewer.text': 'Texto simples',
  resourceUnavailable: 'O serviço de recursos de arquivos está indisponível.',
  rendererUnavailable: 'A prévia de {name} está indisponível.',
  unsupportedFile: 'Ainda não há prévia para este tipo de arquivo.',
  'error.notFound': 'Arquivo não encontrado. Ele pode ter sido movido ou excluído.',
  'error.tooLarge': 'Esta página excede o limite de {limit} e não pode ser lida.',
  'error.notText': 'Ainda não há prévia para este tipo de arquivo.',
  'error.notRegularFile': 'Não é um arquivo comum; nada a exibir.',
  'error.unavailable': 'Falha na leitura: {message}',
  retry: 'Tentar novamente',
} satisfies LocaleDictOf<'sidebarDocumentPreview'>

/** `documentMarkdown` namespace, complete against its owning key set. */
export const documentMarkdownPtBr = {
  'viewer.label': 'Markdown',
  'code.copy': 'Copiar',
  'code.copied': 'Copiado',
  footnotes: 'Notas de rodapé',
} satisfies LocaleDictOf<'documentMarkdown'>

/** `sidebarOffice` namespace, complete against its owning key set. */
export const sidebarOfficePtBr = {
  title: 'Documento do Office',
  loading: 'Renderizando documento...',
  retry: 'Tentar novamente',
  viewMissingFonts: 'Fontes ausentes: {count}. Clique para ver.',
  missingFontsTitle: 'Fontes ausentes',
  missingFontsDescription: 'Estas fontes não estão disponíveis para esta prévia. O texto e o layout podem diferir do documento original.',
  missingFontsCount: 'Fontes: {count}',
  closeDetails: 'Fechar detalhes das fontes',
  unavailable: 'As prévias do Office estão indisponíveis. Ative o serviço de prévia de documentos no computador que executa o CurupiraCode.',
  invalid: 'Este arquivo do Office não pode ser pré-visualizado. Ele pode estar danificado, protegido por senha ou com a extensão errada.',
  tooLarge: 'O arquivo do Office ou o PDF convertido excede o limite de tamanho da prévia. Reduza o arquivo ou ajuste a configuração da prévia.',
  failed: 'A conversão do Office não produziu um PDF utilizável. Verifique o arquivo e tente novamente.',
  timeout: 'A conversão do Office excedeu o tempo limite. Tente novamente.',
  busy: 'A prévia do Office está ocupada. Tente novamente em instantes.',
  changed: 'O arquivo mudou durante a leitura. Abra a prévia novamente.',
} satisfies LocaleDictOf<'sidebarOffice'>

/** `sidebarPdf` namespace, complete against its owning key set. */
export const sidebarPdfPtBr = {
  title: 'PDF',
  pageImage: 'Página {page} do PDF',
  loading: 'Renderizando documento...',
  rendering: 'Renderizando página…',
  failed: 'Não é possível exibir o PDF: {message}',
  password: 'Este PDF exige senha; prévias de arquivos protegidos por senha não são suportadas.',
  workerFailed: 'O processo de renderização do PDF não pôde continuar. Tente novamente.',
  unsupported: 'A prévia de PDF exige o conteúdo completo do arquivo.',
  retry: 'Tentar novamente',
} satisfies LocaleDictOf<'sidebarPdf'>
