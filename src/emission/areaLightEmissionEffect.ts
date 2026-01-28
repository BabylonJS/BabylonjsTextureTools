import { EffectWrapper, EffectRenderer } from "@babylonjs/core/Materials/effectRenderer";
import { ThinEngine } from "@babylonjs/core/Engines/thinEngine";
import { Tools } from "@babylonjs/core/Misc/tools";
import { RenderTargetWrapper } from "@babylonjs/core/Engines/renderTargetWrapper";
import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { AreaLightTextureTools } from "@babylonjs/core/Misc/areaLightsTextureTools";
import { Nullable } from "@babylonjs/core/types";

import "@babylonjs/core/Engines/Extensions/engine.renderTarget";

export class AreaLightEmissionEffect {
    private readonly _engine: ThinEngine;
    private readonly _effectRenderer: EffectRenderer;
    private readonly _blitEffectWrapper: EffectWrapper;
    private readonly _areaLightTextureTools: AreaLightTextureTools;
    private readonly _rtw: RenderTargetWrapper;

    constructor(engine: ThinEngine, effectRenderer: EffectRenderer) {
        this._engine = engine;
        this._effectRenderer = effectRenderer;
        this._areaLightTextureTools = new AreaLightTextureTools(engine);
        this._blitEffectWrapper = this._createEffect();
        this._rtw = this._engine.createRenderTargetTexture({ width: 1024, height: 1024 }, {});
    }

    public async renderAsync(texture?: BaseTexture): Promise<Nullable<BaseTexture>> {
        if (texture) {
            const result = await this._areaLightTextureTools.processAsync(texture);
            this._blitEffectWrapper.effect.setTexture("textureSampler", result);
            this._engine.bindFramebuffer(this._rtw);
            this._engine.setSize(1024, 1024);
            this._effectRenderer.render(this._blitEffectWrapper, this._rtw);
            return result;
        }

        return null;
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
            name: "BlitTexture",
            useShaderStore: true,
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
}