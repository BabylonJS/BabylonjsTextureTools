import { EffectWrapper, EffectRenderer } from "@babylonjs/core/Materials/effectRenderer";
import { ThinEngine } from "@babylonjs/core/Engines/thinEngine";
import { Tools } from "@babylonjs/core/Misc/tools";
import { RenderTargetWrapper } from "@babylonjs/core/Engines/renderTargetWrapper";
import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { AreaLightTextureTools } from "@babylonjs/core/Misc/areaLightsTextureTools";
import { Nullable } from "@babylonjs/core/types";

import "@babylonjs/core/Engines/Extensions/engine.renderTarget";
import { Constants } from "@babylonjs/core/Engines/constants";
import { BlitEffect } from "../blit/blitEffect";

export class AreaLightEmissionEffect {
    private readonly _engine: ThinEngine;
    private readonly _effectRenderer: EffectRenderer;
    private readonly _blitEffectWrapper: EffectWrapper;
    private readonly _areaLightTextureTools: AreaLightTextureTools;
    public readonly rtw: RenderTargetWrapper;

    constructor(engine: ThinEngine, effectRenderer: EffectRenderer) {
        this._engine = engine;
        this._effectRenderer = effectRenderer;
        this._areaLightTextureTools = new AreaLightTextureTools(engine);
        this._blitEffectWrapper = this._createEffect();
        this.rtw = this._createRenderTarget(1024);
    }

    public async renderAsync(texture?: BaseTexture): Promise<void> {
        if (texture) {
            const resultTexture = await this._areaLightTextureTools.processAsync(texture);
            this._blitEffectWrapper.effect.setTexture("textureSampler", resultTexture);
            this._effectRenderer.render(this._blitEffectWrapper, this.rtw);
        }
    }

    public save(texture?: BaseTexture): void {
        const canvas = this._engine.getRenderingCanvas();
        if (canvas) {
            Tools.ToBlob(canvas, (blob) => {
                if (blob) {
                    Tools.Download(blob, "areaLightEmission.png");
                }
            });
        }
    }

    private _createEffect(): EffectWrapper {
        const engine = this._engine;
        const effectWrapper = new EffectWrapper({
            engine: engine,
            name: "CopyEmissionResultTexture",
            useShaderStore: false,
            uniformNames: [],
            samplerNames: ["textureSampler"],
            defines: [],
            fragmentShader: `
            #ifdef GL_ES
            precision highp float;
            #endif

            varying vec2 vUV;
            uniform sampler2D textureSampler;

            void main(void) {
                gl_FragColor = texture2D(textureSampler, vUV);
            }
        `
        });

        return effectWrapper;
    }

    private _createRenderTarget(size: number): RenderTargetWrapper {
        const rtw = this._engine.createRenderTargetTexture(size, {
            format: Constants.TEXTUREFORMAT_RGBA,
            type: Constants.TEXTURETYPE_UNSIGNED_BYTE,
            generateMipMaps: true,
            generateDepthBuffer: false,
            generateStencilBuffer: false,
            samplingMode: Constants.TEXTURE_NEAREST_SAMPLINGMODE
        });
        
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this._engine.updateTextureWrappingMode(rtw.texture!,
            Constants.TEXTURE_CLAMP_ADDRESSMODE,
            Constants.TEXTURE_CLAMP_ADDRESSMODE,
            Constants.TEXTURE_CLAMP_ADDRESSMODE);

        return rtw;
    }
}