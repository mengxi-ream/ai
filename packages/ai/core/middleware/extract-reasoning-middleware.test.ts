import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
} from '@ai-sdk/provider-utils/test';
import { generateText, streamText } from '../generate-text';
import { experimental_wrapLanguageModel } from '../middleware/wrap-language-model';
import { mockId } from '../test/mock-id';
import { MockLanguageModelV1 } from '../test/mock-language-model-v1';
import { extractReasoningMiddleware } from './extract-reasoning-middleware';

describe('extractReasoningMiddleware', () => {
  describe('wrapGenerate', () => {
    it('should extract reasoning from <think> tags', async () => {
      const mockModel = new MockLanguageModelV1({
        async doGenerate() {
          return {
            text: '<think>analyzing the request</think>Here is the response',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 10 },
            rawCall: { rawPrompt: '', rawSettings: {} },
          };
        },
      });

      const result = await generateText({
        model: experimental_wrapLanguageModel({
          model: mockModel,
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        prompt: 'Hello, how can I help?',
      });

      expect(result.reasoning).toStrictEqual('analyzing the request');
      expect(result.text).toStrictEqual('Here is the response');
    });

    it('should extract reasoning from multiple <think> tags', async () => {
      const mockModel = new MockLanguageModelV1({
        async doGenerate() {
          return {
            text: '<think>analyzing the request</think>Here is the response<think>thinking about the response</think>more',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 10 },
            rawCall: { rawPrompt: '', rawSettings: {} },
          };
        },
      });

      const result = await generateText({
        model: experimental_wrapLanguageModel({
          model: mockModel,
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        prompt: 'Hello, how can I help?',
      });

      expect(result.reasoning).toStrictEqual(
        'analyzing the request\nthinking about the response',
      );
      expect(result.text).toStrictEqual('Here is the response\nmore');
    });
  });

  describe('wrapStream', () => {
    it('should extract reasoning from split <think> tags', async () => {
      const mockModel = new MockLanguageModelV1({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-delta', textDelta: '<thi' },
              { type: 'text-delta', textDelta: 'nk>ana' },
              { type: 'text-delta', textDelta: 'lyzing the request' },
              { type: 'text-delta', textDelta: '</thi' },
              { type: 'text-delta', textDelta: 'nk>Here' },
              { type: 'text-delta', textDelta: ' is the response' },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ]),
            rawCall: { rawPrompt: '', rawSettings: {} },
          };
        },
      });

      const result = streamText({
        model: experimental_wrapLanguageModel({
          model: mockModel,
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        prompt: 'Hello, how can I help?',
        experimental_generateMessageId: mockId({ prefix: 'msg' }),
      });

      expect(
        await convertAsyncIterableToArray(result.fullStream),
      ).toStrictEqual([
        {
          messageId: 'msg-0',
          request: {},
          type: 'step-start',
          warnings: [],
        },
        {
          type: 'reasoning',
          textDelta: 'ana',
        },
        {
          type: 'reasoning',
          textDelta: 'lyzing the request',
        },
        {
          type: 'text-delta',
          textDelta: 'Here',
        },
        {
          type: 'text-delta',
          textDelta: ' is the response',
        },
        {
          experimental_providerMetadata: undefined,
          finishReason: 'stop',
          isContinued: false,
          logprobs: undefined,
          messageId: 'msg-0',
          request: {},
          response: {
            headers: undefined,
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          type: 'step-finish',
          usage: {
            completionTokens: 10,
            promptTokens: 3,
            totalTokens: 13,
          },
          warnings: undefined,
        },
        {
          experimental_providerMetadata: undefined,
          finishReason: 'stop',
          logprobs: undefined,
          response: {
            headers: undefined,
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          type: 'finish',
          usage: {
            completionTokens: 10,
            promptTokens: 3,
            totalTokens: 13,
          },
        },
      ]);
    });

    it('should extract reasoning from single chunk with multiple <think> tags', async () => {
      const mockModel = new MockLanguageModelV1({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'text-delta',
                textDelta:
                  '<think>analyzing the request</think>Here is the response<think>thinking about the response</think>more',
              },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ]),
            rawCall: { rawPrompt: '', rawSettings: {} },
          };
        },
      });

      const result = streamText({
        model: experimental_wrapLanguageModel({
          model: mockModel,
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        prompt: 'Hello, how can I help?',
        experimental_generateMessageId: mockId({ prefix: 'msg' }),
      });

      expect(
        await convertAsyncIterableToArray(result.fullStream),
      ).toStrictEqual([
        {
          messageId: 'msg-0',
          request: {},
          type: 'step-start',
          warnings: [],
        },
        {
          type: 'reasoning',
          textDelta: 'analyzing the request',
        },
        {
          type: 'text-delta',
          textDelta: 'Here is the response',
        },
        {
          type: 'reasoning',
          textDelta: '\nthinking about the response',
        },
        {
          type: 'text-delta',
          textDelta: '\nmore',
        },
        {
          experimental_providerMetadata: undefined,
          finishReason: 'stop',
          isContinued: false,
          logprobs: undefined,
          messageId: 'msg-0',
          request: {},
          response: {
            headers: undefined,
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          type: 'step-finish',
          usage: {
            completionTokens: 10,
            promptTokens: 3,
            totalTokens: 13,
          },
          warnings: undefined,
        },
        {
          experimental_providerMetadata: undefined,
          finishReason: 'stop',
          logprobs: undefined,
          response: {
            headers: undefined,
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          type: 'finish',
          usage: {
            completionTokens: 10,
            promptTokens: 3,
            totalTokens: 13,
          },
        },
      ]);
    });
  });
});