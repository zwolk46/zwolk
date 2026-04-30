export type FormatId = string;
export type ConverterId = string;

export type ConverterAvailability = {
  ok: boolean;
  reason?: string;
  executables?: Record<string, string>;
};

export type ConvertContext = {
  signal: AbortSignal;
  log: (line: string) => void;
};

export type ConversionPlan = {
  converterId: ConverterId;
  from: FormatId;
  to: FormatId;
};

export type ConversionResult = {
  converterId: ConverterId;
  outputPath: string;
  outputFilename: string;
};

export type Converter = {
  id: ConverterId;
  label: string;
  description: string;
  availability: () => Promise<ConverterAvailability>;
  supports: (from: FormatId, to: FormatId) => boolean;
  convert: (args: {
    inputPath: string;
    originalFilename: string;
    from: FormatId;
    to: FormatId;
    outputDir: string;
    ctx: ConvertContext;
  }) => Promise<{ outputPath: string; outputFilename: string }>;
};

