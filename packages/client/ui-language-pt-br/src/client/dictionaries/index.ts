/** Every pt-BR dictionary shipped by this language pack, keyed by locale namespace. */

import { commonPtBr, settingsLocalePtBr } from './locale.ts'
import { sessionLogDownloadPtBr } from './session-log-export.ts'
import { settingsAgentPresetPtBr } from './ui-agent-preset.ts'
import { approvalPtBr } from './ui-approval.ts'
import { chatPtBr } from './ui-chat.ts'
import { commandPtBr } from './ui-commands.ts'
import { conversationPtBr } from './ui-conversation.ts'
import { cordisPtBr } from './ui-cordis.ts'
import { deepseekModelLabel1017PtBr } from './ui-deepseek-model-label-1017.ts'
import { deliverablesPtBr } from './ui-deliverables.ts'
import { directoryBrowserPtBr } from './ui-directory-picker-browse.ts'
import { geminiSignInPtBr } from './ui-gemini-sign-in.ts'
import { goalPtBr } from './ui-goal.ts'
import { slashMenuPtBr } from './ui-input-trigger.ts'
import { jobPtBr } from './ui-jobs.ts'
import { shortcutsLayoutPtBr } from './ui-layout.ts'
import { feedbackPtBr } from './ui-message-feedback.ts'
import { modelPtBr } from './ui-model-selection.ts'
import { openInAppPtBr } from './ui-open-in-app.ts'
import { permissionAccessPtBr, settingsPermissionPtBr } from './ui-permission-presets.ts'
import { planPtBr } from './ui-plan.ts'
import { pluginManagerPtBr } from './ui-plugin-manager.ts'
import { pluginMarketPtBr } from './ui-plugin-market.ts'
import { referencePtBr } from './ui-reference.ts'
import { scheduleCatalogPtBr, scheduleManagerPtBr } from './ui-schedule.ts'
import { secretMaskPtBr } from './ui-secret-mask.ts'
import { settingsAccountPtBr } from './ui-settings-account.ts'
import { settingsAgentLoopPtBr } from './ui-settings-agent-loop.ts'
import { settingsPtBr } from './ui-settings-general.ts'
import { settingsModelsPtBr } from './ui-settings-models.ts'
import { settingsPluginInventoryPtBr } from './ui-settings-plugin-inventory.ts'
import { settingsPluginsPtBr } from './ui-settings-plugins.ts'
import { settingsSessionLogPtBr } from './ui-settings-session-log.ts'
import { settingsShellPtBr } from './ui-settings-shell.ts'
import { settingsSubagentPtBr } from './ui-settings-subagent.ts'
import { settingsWebSearchPtBr } from './ui-settings-web-search.ts'
import { shortcutsPtBr } from './ui-shortcuts.ts'
import { sidebarPtBr } from './ui-sidebar.ts'
import { sidebarBrowserPtBr } from './ui-sidebar-browser.ts'
import { sidebarCodePreviewPtBr, sidebarExcelPtBr, documentHtmlPtBr, sidebarImagePtBr, sidebarDocumentPreviewPtBr, documentMarkdownPtBr, sidebarOfficePtBr, sidebarPdfPtBr } from './ui-sidebar-documentpreview.ts'
import { sidebarFilesPtBr } from './ui-sidebar-files.ts'
import { sidebarRightPtBr } from './ui-sidebar-right.ts'
import { sidebarTerminalPtBr } from './ui-sidebar-terminal.ts'
import { skillPtBr } from './ui-skill.ts'
import { subagentPtBr } from './ui-subagent.ts'
import { settingsThemePtBr } from './ui-theme.ts'
import { trajectoryPtBr } from './ui-trajectory.ts'
import { questionPtBr } from './ui-user-questions.ts'
import { workflowRunPtBr } from './ui-workflow-run.ts'
import { workspacePtBr } from './ui-workspace.ts'

/** Namespace to dictionary, in registration order. */
export const PT_BR_DICTIONARIES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'common': commonPtBr,
  'settings.locale': settingsLocalePtBr,
  'settings.agentPreset': settingsAgentPresetPtBr,
  'approval': approvalPtBr,
  'chat': chatPtBr,
  'command': commandPtBr,
  'conversation': conversationPtBr,
  'deepseek-model-label-1017': deepseekModelLabel1017PtBr,
  'deliverables': deliverablesPtBr,
  'directory-browser': directoryBrowserPtBr,
  'goal': goalPtBr,
  'slash.menu': slashMenuPtBr,
  'job': jobPtBr,
  'shortcuts.layout': shortcutsLayoutPtBr,
  'feedback': feedbackPtBr,
  'geminiSignIn': geminiSignInPtBr,
  'model': modelPtBr,
  'open-in-app': openInAppPtBr,
  'permission.access': permissionAccessPtBr,
  'settings.permission': settingsPermissionPtBr,
  'plan': planPtBr,
  'pluginManager': pluginManagerPtBr,
  'pluginMarket': pluginMarketPtBr,
  'reference': referencePtBr,
  'schedule.catalog': scheduleCatalogPtBr,
  'schedule.manager': scheduleManagerPtBr,
  'secretMask': secretMaskPtBr,
  'settings.account': settingsAccountPtBr,
  'settings.agentLoop': settingsAgentLoopPtBr,
  'settings': settingsPtBr,
  'settings.models': settingsModelsPtBr,
  'settings.pluginInventory': settingsPluginInventoryPtBr,
  'settings.plugins': settingsPluginsPtBr,
  'settings.sessionLog': settingsSessionLogPtBr,
  'settings.shell': settingsShellPtBr,
  'settings.subagent': settingsSubagentPtBr,
  'settings.webSearch': settingsWebSearchPtBr,
  'shortcuts': shortcutsPtBr,
  'sidebarBrowser': sidebarBrowserPtBr,
  'sidebarCodePreview': sidebarCodePreviewPtBr,
  'sidebarExcel': sidebarExcelPtBr,
  'documentHtml': documentHtmlPtBr,
  'sidebarImage': sidebarImagePtBr,
  'sidebarDocumentPreview': sidebarDocumentPreviewPtBr,
  'documentMarkdown': documentMarkdownPtBr,
  'sidebarOffice': sidebarOfficePtBr,
  'sidebarPdf': sidebarPdfPtBr,
  'sidebarFiles': sidebarFilesPtBr,
  'sidebarRight': sidebarRightPtBr,
  'sidebarTerminal': sidebarTerminalPtBr,
  'sidebar': sidebarPtBr,
  'skill': skillPtBr,
  'subagent': subagentPtBr,
  'settings.theme': settingsThemePtBr,
  'trajectory': trajectoryPtBr,
  'question': questionPtBr,
  'workflowRun': workflowRunPtBr,
  'workspace': workspacePtBr,
  'cordis': cordisPtBr,
  'session-log-download': sessionLogDownloadPtBr,
}
