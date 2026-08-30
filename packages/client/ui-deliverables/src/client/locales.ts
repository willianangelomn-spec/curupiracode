/** `deliverables` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'deliverables'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'produced.label': '产物',
  'produced.moreOne': '+ 1 个文件',
  'produced.more': '+ {count} 个文件',
  'produced.open': '打开 {name}',
  'produced.showInFolder': '在文件夹中显示',
}

/** English dictionary (same key set). */
export const en: Record<DeliverablesKey, string> = {
  'produced.label': 'Produced',
  'produced.moreOne': '+ 1 file',
  'produced.more': '+ {count} files',
  'produced.open': 'Open {name}',
  'produced.showInFolder': 'Show in folder',
}

/** Union of this namespace's dictionary keys. */
export type DeliverablesKey = keyof typeof zh


/** Brazilian Portuguese dictionary, checked complete against the key-set source of truth. */
export const ptBR = {
  'produced.label': 'Entregas',
  'produced.moreOne': '+ 1 arquivo',
  'produced.more': '+ {count} arquivos',
  'produced.open': 'Abrir {name}',
  'produced.showInFolder': 'Mostrar na pasta',
} satisfies Record<DeliverablesKey, string>
