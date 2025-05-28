import { ThinEngine } from "@babylonjs/core/Engines/thinEngine";
import { Engine } from "@babylonjs/core/Engines/engine";
import { EffectRenderer } from "@babylonjs/core/Materials/effectRenderer";
import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { IblCdfGenerator } from "@babylonjs/core/Rendering/iblCdfGenerator";
import { Color4 } from "@babylonjs/core/Maths/math.color"; 
import { BlitEffect } from "../blit/blitEffect";
import { BlitCubeEffect } from "../blit/blitCubeEffect";
import { BRDFEffect, BRDFMode } from "../brdf/brdfEffect";
import { IBLDiffuseEffect } from "../ibl/iblDiffuseEffect";
import { IBLSpecularEffect } from "../ibl/iblSpecularEffect";
import { LTCEffect } from "../ltc/ltcEffect";
import { Nullable } from "@babylonjs/core/types";

export interface BRDFOptions {
    size: number;
}

const ClearColor = new Color4(0.0, 0.0, 0.0, 1.0);

/**
 * The canvas is responsible to create and orchestrate all the resources
 * the texture tools need (scene, camera...)
 */
export class TextureTools {
    public readonly engine: ThinEngine;

    private readonly _renderer: EffectRenderer;
    private readonly _blitEffect: BlitEffect;
    private readonly _blitCubeEffect: BlitCubeEffect;

    private readonly _brdfEffect: BRDFEffect;
    private readonly _iblDiffuseEffect: IBLDiffuseEffect;
    private readonly _iblSpecularEffect: IBLSpecularEffect;
    private readonly _ltcEffect: LTCEffect;
    private readonly _cdfGenerator: IblCdfGenerator;

    /**
     * Creates an instance of the texture tools associated to a html canvas element
     * @param canvas defines the html element to transform into and ink surface
     */
    constructor(canvas: HTMLCanvasElement) {
        this.engine = this._createEngine(canvas);
        this.engine.getCaps().parallelShaderCompile = undefined;

        this._renderer = new EffectRenderer(this.engine);
        this._blitEffect = new BlitEffect(this.engine, this._renderer);
        this._blitCubeEffect = new BlitCubeEffect(this.engine, this._renderer);
        this._iblDiffuseEffect = new IBLDiffuseEffect(this.engine, this._renderer);
        this._iblSpecularEffect = new IBLSpecularEffect(this.engine, this._renderer);
        this._ltcEffect =  new LTCEffect(64, 32, 0.0001);
        this._cdfGenerator = new IblCdfGenerator(this.engine);
        this._brdfEffect = new BRDFEffect(this.engine, this._renderer);
    }

    /**
     * Renders our BRDF texture.
     */
    public renderBRDF(mode: BRDFMode, sheen: boolean): void {
        this._brdfEffect.render(mode, sheen);
        this._blitEffect.blit(this._brdfEffect.rtw);
    }
    
    /**
     * Saves our BRDF texture.
     */
    public saveBRDF(mode: BRDFMode, sheen: boolean): void {
        this._brdfEffect.save(mode, sheen);

        this._blitEffect.blit(this._brdfEffect.rtw);
    }
    
    public renderLTC() : Nullable<Float32Array> {
        return this._ltcEffect.render();
    }

    public saveLTC(ltc: Float32Array) : void {
        this._ltcEffect.save(ltc);
    }

    /**
     * Renders our IBL Diffuse texture.
     */
    public renderDiffuseIBL(texture: BaseTexture): void {
        this._cdfGenerator.onGeneratedObservable.addOnce(() => {
            this._cdfGenerator.findDominantDirection().then((direction) => {
                this._iblDiffuseEffect.render(texture, this._cdfGenerator.getIcdfTexture());
                this._blitCubeEffect.blit(this._iblDiffuseEffect.rtw, 0);
                // TODO - Do something with the dominant direction
            });
        });
        this._cdfGenerator.iblSource = texture;
        this._cdfGenerator.renderWhenReady();
    }

    public blitSpecularIBL(lod: number): void {
        if (!this._iblSpecularEffect.rtw) {
            return;
        }
        this._blitCubeEffect.blit(this._iblSpecularEffect.rtw, lod);
    }

    /**
     * Saves our IBL Specular texture.
     */
    public saveSpecularIBL(texture: BaseTexture, size: number): void {
        this._iblSpecularEffect.save(texture, size);

        this._blitCubeEffect.blit(this._iblSpecularEffect.rtw, 0);
    }

    public clear(): void {
        this.engine.clear(ClearColor, true, true, true);
    }

    private _createEngine(canvas: HTMLCanvasElement): ThinEngine {
        // Create our engine to hold on the canvas
        const engine = new Engine(canvas, true, { 
            preserveDrawingBuffer: true,
            premultipliedAlpha: false,
            alpha: true,
        });
        return engine;
    }
}
