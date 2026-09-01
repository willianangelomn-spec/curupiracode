/** Portable local text embeddings powered by Transformers.js and ONNX. */

import { pipeline, type FeatureExtractionPipeline, type Tensor } from '@huggingface/transformers'

/** Default multilingual model; MIT-licensed and Transformers.js compatible. */
export const DEFAULT_EMBEDDING_MODEL = 'Xenova/multilingual-e5-small'

/** Small seam retained so store tests can inject deterministic embeddings. */
export interface TextEmbedder {
  readonly model: string
  embed(texts: readonly string[], kind: 'query' | 'passage', signal?: AbortSignal): Promise<readonly Float32Array[]>
  dispose(): Promise<void>
}

/** Lazy, process-local ONNX embedder. Model files live in the supplied cache. */
export class TransformersTextEmbedder implements TextEmbedder {
  private loader: Promise<FeatureExtractionPipeline> | undefined
  private loaded: FeatureExtractionPipeline | undefined

  constructor(readonly model: string, private readonly cacheDir: string) {}

  async embed(
    texts: readonly string[],
    kind: 'query' | 'passage',
    signal?: AbortSignal,
  ): Promise<readonly Float32Array[]> {
    signal?.throwIfAborted()
    if (texts.length === 0) return []
    const extractor = await this.pipeline()
    signal?.throwIfAborted()
    const prefixed = texts.map(text => `${kind}: ${text}`)
    const output: Tensor = await extractor(prefixed, { pooling: 'mean', normalize: true })
    signal?.throwIfAborted()
    const dimensions = output.dims.at(-1)
    const rawData: unknown = output.data
    if (!Array.isArray(rawData) && !ArrayBuffer.isView(rawData)) {
      throw new Error(`embedding model "${this.model}" returned unsupported tensor data`)
    }
    const values = Array.from(rawData as ArrayLike<unknown>, (value) => {
      if (typeof value !== 'number') throw new Error('embedding tensor contained a non-numeric value')
      return value
    })
    if (dimensions === undefined || dimensions < 1 || values.length !== texts.length * dimensions) {
      throw new Error(`embedding model "${this.model}" returned an unexpected tensor shape`)
    }
    return texts.map((_, index) => Float32Array.from(
      values.slice(index * dimensions, (index + 1) * dimensions),
    ))
  }

  async dispose(): Promise<void> {
    const loaded = this.loaded
    this.loaded = undefined
    this.loader = undefined
    if (loaded !== undefined) await loaded.dispose()
  }

  private pipeline(): Promise<FeatureExtractionPipeline> {
    this.loader ??= pipeline('feature-extraction', this.model, {
      cache_dir: this.cacheDir,
      // Quantized weights keep first-use download and RAM reasonable on
      // ordinary laptops while preserving multilingual retrieval quality.
      dtype: 'q8',
    }).then((loaded) => {
      this.loaded = loaded
      return loaded
    }).catch((error: unknown) => {
      this.loader = undefined
      throw error
    })
    return this.loader
  }
}
