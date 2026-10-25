import type { ErrorCode } from './errors';
import type { ImageFormat } from './image';

export type ConvertRequest = {
  kind: 'convert';
  id: number;
  file: File;
  target: ImageFormat;
  quality: number;
  width: number | null;
  height: number | null;
  keepRatio: boolean;
};

export type PngRequest = {
  kind: 'png';
  id: number;
  buffer: ArrayBuffer;
  mime: string;
};

export type Base64EncodeRequest = {
  kind: 'base64-encode';
  id: number;
  buffer: ArrayBuffer;
};

export type Base64DecodeRequest = {
  kind: 'base64-decode';
  id: number;
  text: string;
};

export type WorkerRequest = ConvertRequest | PngRequest | Base64EncodeRequest | Base64DecodeRequest;

export type WorkerResponse =
  | { id: number; ok: true; buffer: ArrayBuffer; mime: string }
  | { id: number; ok: true; text: string }
  | { id: number; ok: false; error: { code: ErrorCode } };
