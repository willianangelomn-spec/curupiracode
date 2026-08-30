/** Durable settings namespace for product-wide GUI onboarding facts. */
export const WELCOME_NOTICE_SETTINGS_NAMESPACE = 'ui-onboarding'

/** Field storing the last welcome notice version the user acknowledged. */
export const WELCOME_NOTICE_ACK_FIELD = 'welcomeNoticeVersion'

/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export const WELCOME_NOTICE_VERSION = '2026-08-28.1'

/** The complete editable internal-testing notice in all supported GUI locales. */
export const WELCOME_NOTICE_COPY = {
  zh: {
    title: '内测声明',
    body: 'CurupiraCode 0.1 目前处于开发者预览阶段，核心插件和基础 API 仍在快速演进。我们欢迎社区反馈，并坚持开放、可复用、可组合和本地优先的基础设施。\n\nCurupiraCode 基于 DeepSeek Harness 的开源代码构建，是一个独立的社区项目。',
    continueLabel: '继续',
  },
  en: {
    title: 'Internal Testing Notice',
    body: 'CurupiraCode 0.1 is a developer preview whose core plugins and APIs are evolving quickly. Community feedback is welcome as we build open, reusable, composable, and local-first AI infrastructure.\n\nCurupiraCode is an independent community project built from the open-source DeepSeek Harness codebase.',
    continueLabel: 'Continue',
  },
  'pt-BR': {
    title: 'Boas-vindas ao CurupiraCode',
    body: 'O CurupiraCode 0.1 está em prévia para desenvolvedores, com plugins centrais e APIs em evolução rápida. Queremos construir com a comunidade uma infraestrutura de IA aberta, reutilizável, combinável e que priorize o ambiente local.\n\nO CurupiraCode é um projeto comunitário independente, criado a partir do código aberto do DeepSeek Harness.',
    continueLabel: 'Continuar',
  },
} as const
