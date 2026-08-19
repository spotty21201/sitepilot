declare module 'howler' {
  export interface HowlOptions {
    src: string | string[];
    volume?: number;
    html5?: boolean;
    loop?: boolean;
    preload?: boolean | string;
    autoplay?: boolean;
    mute?: boolean;
    sprite?: Record<string, [number, number] | [number, number, boolean]>;
    rate?: number;
    pool?: number;
    format?: string[];
    xhr?: Record<string, any>;
    onload?: () => void;
    onloaderror?: (id: number, error: any) => void;
    onplayerror?: (id: number, error: any) => void;
    onplay?: (id: number) => void;
    onend?: (id: number) => void;
    onpause?: (id: number) => void;
    onstop?: (id: number) => void;
    onmute?: (id: number) => void;
    onvolume?: (id: number) => void;
    onrate?: (id: number) => void;
    onseek?: (id: number) => void;
    onfade?: (id: number) => void;
    onunlock?: () => void;
  }

  export class Howl {
    constructor(options?: HowlOptions);
    play(spriteOrId?: string | number): number;
    pause(id?: number): this;
    stop(id?: number): this;
    mute(muted?: boolean, id?: number): this | boolean;
    volume(vol?: number, id?: number): this | number;
    fade(from: number, to: number, duration: number, id?: number): this;
    rate(rate?: number, id?: number): this | number;
    seek(seek?: number, id?: number): this | number;
    loop(loop?: boolean, id?: number): this | boolean;
    state(): 'unloaded' | 'loading' | 'loaded';
    playing(id?: number): boolean;
    duration(id?: number): number;
    on(event: string, fn: Function, id?: number): this;
    once(event: string, fn: Function, id?: number): this;
    off(event: string, fn?: Function, id?: number): this;
    load(): this;
    unload(): void;
  }

  export const Howler: {
    mute(muted: boolean): typeof Howler;
    volume(vol?: number): typeof Howler | number;
    codecs(ext: string): boolean;
    unload(): typeof Howler;
    usingWebAudio: boolean;
    html5PoolSize: number;
    noAudio: boolean;
    autoUnlock: boolean;
    autoSuspend: boolean;
    ctx: AudioContext;
    masterGain: GainNode;
  };
}
