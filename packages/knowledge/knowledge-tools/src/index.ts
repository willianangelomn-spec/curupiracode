/**
 * Agent tools over the knowledge seam — Curupira Memória, available as soon as
 * the bundle loads. `knowledge_ingest` reads a file or folder from the local
 * disk into the content-addressed vault; `knowledge_search` retrieves passages
 * with full provenance; `knowledge_documents` lists what the vault holds.
 *
 * The tools read the local filesystem directly (they are the user's own
 * authorized materials) and pass bytes to the seam, which never reads the
 * filesystem itself.
 *
 * @module @deepseek-ai/dsh-knowledge-tools
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, join, basename } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { defineTool, InferValue } from '@deepseek-ai/dsh-tools'
// Loads the `declare module` augmentation exposing `ctx.knowledge`.
import '@deepseek-ai/dsh-knowledge'
import '@deepseek-ai/dsh-system-prompt'

/** Cordis plugin name. */
export const name = 'knowledge-tools'

/** Services required before this plugin can register its tools. */
export const inject = ['knowledge', 'tools', 'systemPrompt']

/** Folder walk limits, so an accidental giant scan stays bounded. */
const MAX_FILES = 500
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FAILURES = 10

/** Extensions the local extractors can read. */
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.html', '.htm', '.docx', '.pdf'])

/** Skip hidden and build directories while walking a folder. */
function skipDirectory(name: string): boolean {
  return name.startsWith('.') || name === 'node_modules' || name === 'dist'
}

/** Collect ingestible files from a path (file or folder), bounded. */
async function collectFiles(path: string): Promise<{ files: string[]; errors: string[] }> {
  const files: string[] = []
  const errors: string[] = []
  const info = await stat(path)
  if (info.isFile()) {
    if (ALLOWED_EXTENSIONS.has(extname(path).toLowerCase())) files.push(path)
    else errors.push(`${basename(path)} (formato não suportado)`)
    return { files, errors }
  }
  const queue = [path]
  while (queue.length > 0 && files.length < MAX_FILES) {
    const current = queue.shift() as string
    let entries: { name: string; isDirectory(): boolean }[]
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch (error: unknown) {
      if (errors.length < MAX_FAILURES) errors.push(`${current}: ${String(error)}`)
      continue
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break
      if (entry.isDirectory()) {
        if (!skipDirectory(entry.name)) queue.push(join(current, entry.name))
        continue
      }
      const full = join(current, entry.name)
      if (!ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue
      let size = 0
      try {
        size = (await stat(full)).size
      } catch {
        continue
      }
      if (size > MAX_FILE_BYTES) {
        if (errors.length < MAX_FAILURES) errors.push(`${basename(full)} (maior que 20 MB)`)
        continue
      }
      files.push(full)
    }
  }
  if (files.length >= MAX_FILES && queue.length > 0 && errors.length < MAX_FAILURES) {
    errors.push(`limite de ${MAX_FILES} arquivos atingido; o restante foi ignorado`)
  }
  return { files, errors }
}

/** JSON string renderer for tool outputs (mirrors the Team tools idiom). */
/* jscpd:ignore-start -- shared fixed-record tool-output idiom */
function jsonOutput<const S extends { type: 'object' }>(schema: S): {
  schema: S
  render: (args: unknown, value: InferValue<S>) => [{ type: 'text'; text: string }]
} {
  return {
    schema,
    render: (_args: unknown, value: InferValue<S>) => [{ type: 'text', text: JSON.stringify(value) }],
  }
}
/* jscpd:ignore-end */

const INGEST_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    caminho: { type: 'string', required: true },
    arquivos_encontrados: { type: 'number', required: true },
    ingeridos: { type: 'number', required: true },
    ja_presentes: { type: 'number', required: true },
    falhas: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: { nome: { type: 'string', required: true }, erro: { type: 'string', required: true } } },
    },
  },
} as const

const SEARCH_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resultados: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          documento: { type: 'string', required: true },
          origem: { type: 'string', required: true },
          localizador: { type: 'string', required: true },
          trecho: { type: 'string', required: true },
          inicio: { type: 'number', required: true },
          fim: { type: 'number', required: true },
        },
      },
    },
    truncado: { type: 'boolean', required: true },
  },
} as const

const DOCUMENTS_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    total: { type: 'number', required: true },
    documentos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          nome: { type: 'string', required: true },
          origem: { type: 'string', required: true },
          passagens: { type: 'number', required: true },
        },
      },
    },
  },
} as const

const RELATED_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    relacionados: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          documento: { type: 'string', required: true },
          origem: { type: 'string', required: true },
          similaridade: { type: 'number', required: true },
        },
      },
    },
  },
} as const

/**
 * Register the knowledge tools with the harness tools seam.
 * @param ctx - Cordis context carrying the knowledge service.
 * @returns Nothing; tools unregister with the calling fiber.
 */
export function apply(ctx: Context): void {
  ctx.effect(function* () {
    const disposers: Array<() => unknown> = []

    disposers.push(ctx.systemPrompt.section({
      name: 'tool:curupira-memory',
      order: 116,
      text: 'Curupira Memória is the user\'s local second brain. When a request may depend on the user\'s '
        + 'stored notes or documents, search it proactively with knowledge_search before answering; do not wait '
        + 'for the user to name the tool. Ground claims in the returned passages and cite document name plus '
        + 'origin or locator. Use knowledge_related to discover connections between stored materials. Never invent '
        + 'a citation, and say clearly when the vault has no supporting material.',
    }))

    disposers.push(ctx.tools.register(defineTool({
      name: 'knowledge_ingest',
      description: 'Lê um arquivo ou uma pasta (vault do Obsidian, documentos, anotações) do disco local, '
        + 'extrai o texto (PDF, DOCX, HTML, Markdown, texto puro) e guarda no segundo cérebro local '
        + '(Curupira Memória). Reingerir o mesmo conteúdo é inofensivo e não duplica.',
      parameters: {
        path: { type: 'string', required: true, description: 'Caminho absoluto do arquivo ou da pasta a ingerir.' },
      },
      output: jsonOutput(INGEST_VALUE_SCHEMA),
      async execute(args, exec) {
        const { files, errors } = await collectFiles(args.path)
        let ingeridos = 0
        let jaPresentes = 0
        const falhas: { nome: string; erro: string }[] = []
        for (const file of files) {
          try {
            const content = new Uint8Array(await readFile(file))
            const result = await ctx.knowledge.ingest({
              content,
              name: basename(file),
              origin: file,
              format: extname(file).slice(1).toLowerCase(),
            }, exec.signal)
            if (result.alreadyPresent) jaPresentes += 1
            else ingeridos += 1
          } catch (error: unknown) {
            if (falhas.length < MAX_FAILURES) {
              falhas.push({ nome: basename(file), erro: String(error).slice(0, 200) })
            }
          }
        }
        for (const error of errors) falhas.push({ nome: error.split(' ')[0] ?? 'pasta', erro: error })
        return {
          caminho: args.path,
          arquivos_encontrados: files.length,
          ingeridos,
          ja_presentes: jaPresentes,
          falhas,
        }
      },
    })))

    disposers.push(ctx.tools.register(defineTool({
      name: 'knowledge_search',
      description: 'Busca nas anotações e documentos já ingeridos no segundo cérebro local (Curupira Memória). '
        + 'Use quando a pergunta depender de materiais do usuário (vault, leis, processos, estudos). '
        + 'Retorna trechos com proveniência (documento, localização e offset).',
      parameters: {
        query: { type: 'string', required: true, description: 'Pergunta ou termos a buscar.' },
        maxResults: { type: 'number', description: 'Máximo de trechos (padrão 10).' },
      },
      output: jsonOutput(SEARCH_VALUE_SCHEMA),
      async execute(args, exec) {
        const found = await ctx.knowledge.search(
          { query: args.query, ...(args.maxResults !== undefined ? { maxResults: args.maxResults } : {}) },
          exec.signal,
        )
        return {
          resultados: found.passages.map(passage => ({
            documento: passage.documentName,
            origem: passage.origin ?? '',
            localizador: passage.locator ?? '',
            trecho: passage.text.slice(0, 800),
            inicio: passage.start,
            fim: passage.end,
          })),
          truncado: found.truncated,
        }
      },
    })))

    disposers.push(ctx.tools.register(defineTool({
      name: 'knowledge_documents',
      description: 'Lista os documentos guardados no segundo cérebro local (Curupira Memória), com contagem de passagens.',
      parameters: {},
      output: jsonOutput(DOCUMENTS_VALUE_SCHEMA),
      async execute(_args, exec) {
        const documents = await ctx.knowledge.documents(exec.signal)
        return {
          total: documents.length,
          documentos: documents.map(doc => ({
            id: doc.id,
            nome: doc.name,
            origem: doc.origin ?? '',
            passagens: doc.passageCount,
          })),
        }
      },
    })))

    disposers.push(ctx.tools.register(defineTool({
      name: 'knowledge_related',
      description: 'Encontra conexões semânticas entre um documento e outros materiais do Curupira Memória. '
        + 'Use para descobrir assuntos, notas e fontes relacionadas mesmo quando não usam as mesmas palavras.',
      parameters: {
        documentId: { type: 'string', required: true, description: 'ID do documento de origem.' },
        maxResults: { type: 'number', description: 'Máximo de relações (padrão 8).' },
      },
      output: jsonOutput(RELATED_VALUE_SCHEMA),
      async execute(args, exec) {
        const related = await ctx.knowledge.related(args.documentId, args.maxResults ?? 8, exec.signal)
        return {
          relacionados: related.map(item => ({
            id: item.documentId,
            documento: item.documentName,
            origem: item.origin ?? '',
            similaridade: item.score,
          })),
        }
      },
    })))

    yield () => {
      for (const dispose of disposers) dispose()
    }
  }, 'knowledge-tools.apply()')
}
