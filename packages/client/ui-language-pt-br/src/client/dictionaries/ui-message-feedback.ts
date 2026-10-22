/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-message-feedback`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-message-feedback/client'

/** `feedback` namespace, complete against its owning key set. */
export const feedbackPtBr = {
  'action.like': 'Boa resposta',
  'action.likeActive': 'Remover avaliação',
  'action.dislike': 'Resposta ruim',
  'action.dislikeActive': 'Remover avaliação',
  'dialog.title': 'Enviar feedback',
  'dialog.categories': 'Categoria do feedback',
  'dialog.detail': 'Detalhes do feedback',
  'dialog.hint': 'Adicione detalhes para nos ajudar a melhorar. O envio incluirá o registro da conversa atual.',
  'category.task-result': 'Resultado da tarefa',
  'category.instruction-following': 'Compreensão e cumprimento de instruções',
  'category.product-interaction': 'Recursos e interação do produto',
  'category.service-stability': 'Estabilidade e velocidade',
  'category.resource-cost': 'Uso de recursos e custo',
  'category.security-privacy-permission': 'Segurança, privacidade e permissões',
  'category.other': 'Outro',
  'toast.recorded': 'Obrigado pelo feedback',
  'error.conflict': 'Este feedback foi alterado em outro lugar; o estado mais recente é exibido',
  'error.load': 'Não foi possível carregar o feedback',
  'error.generic': 'Não foi possível salvar o feedback',
  'error.noteTooLarge': 'A descrição é longa demais; encurte-a e envie novamente',
} satisfies LocaleDictOf<'feedback'>
