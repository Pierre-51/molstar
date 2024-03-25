/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import * as HME from 'h264-mp4-encoder';
import { Viewport } from '../../mol-canvas3d/camera/util';
import { ImagePass } from '../../mol-canvas3d/passes/image';
import { PluginStateAnimation } from '../../mol-plugin-state/animation/model';
import { PluginContext } from '../../mol-plugin/context';
import { RuntimeContext } from '../../mol-task';
import { Color } from '../../mol-util/color';
import {ParamDefinition} from "../../mol-util/param-definition";
import {PostprocessingParams, PostprocessingProps} from "../../mol-canvas3d/passes/postprocessing";
import path from "path";
// import WebMWriter from "webm-writer";
// const WebMWriter = require('webm-writer');

// import * as FFmpeg from '@unaxiom/ffmpeg';


export interface Mp4EncoderParams<A extends PluginStateAnimation = PluginStateAnimation> {
    pass: ImagePass,
    customBackground?: Color,
    animation: PluginStateAnimation.Instance<A>,
    postprocessing?: Partial<PostprocessingProps>,
    width: number,
    height: number,
    viewport: Viewport,
    /** default is 30 */
    fps?: number,
    /** Number from 10 (best quality, slowest) to 51 (worst, fastest) */
    quantizationParameter?: number
}

export async function encodeMp4Animation<A extends PluginStateAnimation>(plugin: PluginContext, ctx: RuntimeContext, params: Mp4EncoderParams<A>) {
    await ctx.update({ message: 'Initializing...', isIndeterminate: true });

    validateViewport(params);
    const durationMs = PluginStateAnimation.getDuration(plugin, params.animation);
    if (durationMs === void 0) {
        throw new Error('The animation does not have the duration specified.');
    }

    const encoder = await HME.createH264MP4Encoder();

    // const encoder = new WebMWriter({
    //     quality: 0.95,    // WebM image quality from 0.0 (worst) to 0.99999 (best), 1.00 (VP8L lossless) is not supported
    //     fileWriter: null, // FileWriter in order to stream to a file instead of buffering to memory (optional)
    //     fd: null,         // Node.js file handle to write to instead of buffering to memory (optional)
    //
    //     // You must supply one of:
    //     frameDuration: null, // Duration of frames in milliseconds
    //     frameRate: 30,     // Number of frames per second
    //
    //     transparent: true,      // True if an alpha channel should be included in the video
    //     alphaQuality: undefined, // Allows you to set the quality level of the alpha channel separately.
    //                              // If not specified this defaults to the same value as `quality`.
    // })

    // var encoder = new FFmpeg.FFmpeg();

    const { width, height } = params;
    let vw = params.viewport.width, vh = params.viewport.height;

    // dimensions must be a multiple of 2
    if (vw % 2 !== 0) vw -= 1;
    if (vh % 2 !== 0) vh -= 1;

    const normalizedViewport: Viewport = { ...params.viewport, width: vw, height: vh };

    encoder.width = vw;
    encoder.height = vh;
    if (params.quantizationParameter) encoder.quantizationParameter = params.quantizationParameter;
    if (params.fps) encoder.frameRate = params.fps;
    encoder.initialize();

    const loop = plugin.animationLoop;
    const canvasProps = plugin.canvas3d?.props;
    const wasAnimating = loop.isAnimating;
    let stoppedAnimation = true, finalized = false;

    params.pass.setProps({
        postprocessing: ParamDefinition.merge(PostprocessingParams, params.pass.props.postprocessing, params.postprocessing),
    });

    try {
        loop.stop();
        loop.resetTime(0);

        if (params.customBackground !== void 0) {
            plugin.canvas3d?.setProps({ renderer: { backgroundColor: params.customBackground }, transparentBackground: false }, true);
        }

        const fps = encoder.frameRate;
        const N = Math.ceil(durationMs / 1000 * fps);
        const dt = durationMs / N;

        await ctx.update({ message: 'Rendering...', isIndeterminate: false, current: 0, max: N + 1 });
        await params.pass.updateBackground();

        await plugin.managers.animation.play(params.animation.definition, params.animation.params);
        stoppedAnimation = false;
        for (let i = 0; i <= N; i++) {
            await loop.tick(i * dt, { isSynchronous: true, animation: { currentFrame: i, frameCount: N }, manualDraw: true });

            const image = params.pass.getImageData(width, height, normalizedViewport);
            encoder.addFrameRgba(image.data);

            if (ctx.shouldUpdate) {
                await ctx.update({ current: i + 1 });
            }
        }
        await ctx.update({ message: 'Applying finishing touches...', isIndeterminate: true });
        await plugin.managers.animation.stop();
        stoppedAnimation = true;
        encoder.finalize();
        finalized = true;
        // encoder.
        // return encoder.complete();
        return encoder.FS.readFile(encoder.outputFilename);


    } finally {
        if (finalized) encoder.delete();
        if (params.customBackground !== void 0) {
            plugin.canvas3d?.setProps({ renderer: { backgroundColor: canvasProps?.renderer!.backgroundColor }, transparentBackground: canvasProps?.transparentBackground });
        }
        if (!stoppedAnimation) await plugin.managers.animation.stop();
        if (wasAnimating) loop.start();
    }
}

function validateViewport(params: Mp4EncoderParams) {
    if (params.viewport.x + params.viewport.width > params.width || params.viewport.y + params.viewport.height > params.height) {
        throw new Error('Viewport exceeds the canvas dimensions.');
    }
}