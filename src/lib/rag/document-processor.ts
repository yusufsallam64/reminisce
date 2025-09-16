import { DocumentChunk, ChunkingOptions, ContentType, RAGError } from './types';
import { v4 as uuidv4 } from 'uuid';

export class DocumentProcessor {
  private static readonly DEFAULT_CHUNK_SIZE = 1000;
  private static readonly DEFAULT_OVERLAP = 200;
  private static readonly MIN_CHUNK_SIZE = 100;

  static chunkDocument(
    content: string,
    title: string,
    contentType: ContentType,
    options: ChunkingOptions = {},
    source?: string
  ): DocumentChunk[] {
    const {
      maxChunkSize = this.DEFAULT_CHUNK_SIZE,
      overlapSize = this.DEFAULT_OVERLAP,
      preserveSentences = true
    } = options;

    if (maxChunkSize < this.MIN_CHUNK_SIZE) {
      throw new RAGError(
        `Chunk size must be at least ${this.MIN_CHUNK_SIZE} characters`,
        'VALIDATION_ERROR'
      );
    }

    if (overlapSize >= maxChunkSize) {
      throw new RAGError(
        'Overlap size must be less than chunk size',
        'VALIDATION_ERROR'
      );
    }

    const cleanContent = this.preprocessText(content);

    if (cleanContent.length <= maxChunkSize) {
      return [{
        text: cleanContent,
        chunkId: uuidv4(),
        chunkIndex: 0,
        metadata: {
          title,
          contentType,
          source
        }
      }];
    }

    return preserveSentences
      ? this.chunkBySentences(cleanContent, title, contentType, maxChunkSize, overlapSize, source)
      : this.chunkByCharacters(cleanContent, title, contentType, maxChunkSize, overlapSize, source);
  }

  private static preprocessText(content: string): string {
    return content
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\r/g, '\n')            // Handle old Mac line endings
      .replace(/\n{3,}/g, '\n\n')      // Reduce multiple newlines to double
      .replace(/[ \t]+/g, ' ')         // Normalize whitespace
      .replace(/^\s+|\s+$/g, '')       // Trim start and end
      .replace(/\s+([.!?])/g, '$1');   // Remove space before punctuation
  }

  private static chunkBySentences(
    content: string,
    title: string,
    contentType: ContentType,
    maxChunkSize: number,
    overlapSize: number,
    source?: string
  ): DocumentChunk[] {
    const sentences = this.splitIntoSentences(content);
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const proposedChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

      if (proposedChunk.length <= maxChunkSize) {
        currentChunk = proposedChunk;
      } else {
        if (currentChunk) {
          chunks.push({
            text: currentChunk.trim(),
            chunkId: uuidv4(),
            chunkIndex: chunkIndex++,
            metadata: { title, contentType, source }
          });

          // Create overlap by including last portion of current chunk
          currentChunk = this.createOverlap(currentChunk, overlapSize) + ' ' + sentence;
        } else {
          // Single sentence is too long, split it by characters
          const longSentenceChunks = this.chunkByCharacters(
            sentence, title, contentType, maxChunkSize, overlapSize, source
          );
          chunks.push(...longSentenceChunks.map(chunk => ({
            ...chunk,
            chunkIndex: chunkIndex++
          })));
        }
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        chunkId: uuidv4(),
        chunkIndex: chunkIndex,
        metadata: { title, contentType, source }
      });
    }

    return chunks;
  }

  private static chunkByCharacters(
    content: string,
    title: string,
    contentType: ContentType,
    maxChunkSize: number,
    overlapSize: number,
    source?: string
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let position = 0;
    let chunkIndex = 0;

    while (position < content.length) {
      const endPosition = Math.min(position + maxChunkSize, content.length);
      let chunkText = content.slice(position, endPosition);

      // Try to break at word boundary if not at end of content
      if (endPosition < content.length) {
        const lastSpaceIndex = chunkText.lastIndexOf(' ');
        if (lastSpaceIndex > maxChunkSize * 0.8) { // Only break at word if reasonably close to chunk size
          chunkText = chunkText.slice(0, lastSpaceIndex);
        }
      }

      chunks.push({
        text: chunkText.trim(),
        chunkId: uuidv4(),
        chunkIndex: chunkIndex++,
        metadata: { title, contentType, source }
      });

      // Move position forward with overlap
      position += chunkText.length - overlapSize;
      if (position <= 0) position = chunkText.length; // Prevent infinite loop
    }

    return chunks;
  }

  private static splitIntoSentences(text: string): string[] {
    // Enhanced sentence splitting that handles common abbreviations
    const abbreviations = new Set([
      'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr', 'Inc', 'Ltd', 'Co',
      'vs', 'etc', 'e.g', 'i.e', 'viz', 'cf', 'al', 'Apr', 'Aug', 'Dec',
      'Feb', 'Jan', 'Jul', 'Jun', 'Mar', 'May', 'Nov', 'Oct', 'Sep'
    ]);

    const sentences: string[] = [];
    let currentSentence = '';
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      currentSentence += char;

      if (char === '.' || char === '!' || char === '?') {
        // Check if this is end of sentence or abbreviation
        const beforePeriod = this.getWordBefore(text, i);
        const afterPeriod = this.getCharAfter(text, i);

        const isAbbreviation = abbreviations.has(beforePeriod);
        const isEndOfSentence = !isAbbreviation &&
          (afterPeriod === '' || afterPeriod === ' ' || afterPeriod === '\n');

        if (isEndOfSentence) {
          sentences.push(currentSentence.trim());
          currentSentence = '';
        }
      }

      i++;
    }

    if (currentSentence.trim()) {
      sentences.push(currentSentence.trim());
    }

    return sentences.filter(s => s.length > 0);
  }

  private static getWordBefore(text: string, position: number): string {
    let start = position - 1;
    while (start >= 0 && /\s/.test(text[start])) {
      start--;
    }

    let end = start;
    while (start >= 0 && !/\s/.test(text[start])) {
      start--;
    }

    return text.slice(start + 1, end + 1);
  }

  private static getCharAfter(text: string, position: number): string {
    let next = position + 1;
    while (next < text.length && text[next] === ' ') {
      next++;
    }
    return next < text.length ? text[next] : '';
  }

  private static createOverlap(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    const start = text.length - overlapSize;
    const overlap = text.slice(start);

    // Try to start overlap at word boundary
    const firstSpaceIndex = overlap.indexOf(' ');
    if (firstSpaceIndex > 0 && firstSpaceIndex < overlapSize * 0.3) {
      return overlap.slice(firstSpaceIndex + 1);
    }

    return overlap;
  }

  static extractKeywords(text: string, maxKeywords: number = 10): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
      'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who',
      'boy', 'did', 'use', 'man', 'work', 'life', 'them', 'been', 'many',
      'after', 'back', 'other', 'good', 'just', 'first', 'time', 'very'
    ]);

    const wordFreq = new Map<string, number>();
    words
      .filter(word => !stopWords.has(word))
      .forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }

  static generateSummary(text: string, maxLength: number = 200): string {
    if (text.length <= maxLength) {
      return text;
    }

    const sentences = this.splitIntoSentences(text);
    let summary = '';

    for (const sentence of sentences) {
      if (summary.length + sentence.length <= maxLength) {
        summary += sentence + ' ';
      } else {
        break;
      }
    }

    return summary.trim() || text.slice(0, maxLength) + '...';
  }
}