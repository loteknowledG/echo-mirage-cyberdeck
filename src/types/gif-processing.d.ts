declare module "gif-frames" {
  type GifFrameInfo = {
    width: number;
    height: number;
    delay: number;
    disposal: number;
  };

  type GifFrameResult = {
    frameInfo: GifFrameInfo;
    getImage: () => NodeJS.ReadableStream;
  };

  type GifFramesOptions = {
    url: string | Buffer;
    frames: "all" | number | number[];
    outputType?: "png" | "jpg" | "canvas" | "bmp";
    cumulative?: boolean;
  };

  function gifFrames(options: GifFramesOptions): Promise<GifFrameResult[]>;
  export = gifFrames;
}

declare module "gif-encoder-2" {
  class GIFEncoder {
    constructor(
      width: number,
      height: number,
      algorithm?: string,
      useOptimizer?: boolean,
      totalFrames?: number,
    );
    start(): void;
    setRepeat(repeat: number): void;
    setDelay(delay: number): void;
    setDispose(disposal: number): void;
    setTransparent(transparent: boolean): void;
    setQuality(quality: number): void;
    addFrame(ctx: unknown): void;
    finish(): void;
    on(event: "progress", listener: (percent: number) => void): void;
    createReadStream(): NodeJS.ReadableStream;
    out: { getData(): Buffer };
  }
  export = GIFEncoder;
}
