/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */
// import * as HME from 'h264-mp4-encoder';
import {Viewport} from '../../mol-canvas3d/camera/util';
import {ImagePass} from '../../mol-canvas3d/passes/image';
import {PluginStateAnimation} from '../../mol-plugin-state/animation/model';
import {PluginContext} from '../../mol-plugin/context';
import {RuntimeContext} from '../../mol-task';
import {Color} from '../../mol-util/color';
import {ParamDefinition} from "../../mol-util/param-definition";
import {PostprocessingParams, PostprocessingProps} from "../../mol-canvas3d/passes/postprocessing";
import {createCanvas} from "canvas";

const {Readable} = require('stream');
var ffmpeg = require('fluent-ffmpeg');


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
    // await ctx.update({message: 'Initializing...', isIndeterminate: true});
    //
    // if (!params.fps) params.fps = 30;
    //
    // validateViewport(params);
    // const durationMs = PluginStateAnimation.getDuration(plugin, params.animation);
    // if (durationMs === void 0) {
    //     throw new Error('The animation does not have the duration specified.');
    // }
    //
    // const encoder = await HME.createH264MP4Encoder();
    //
    // const {width, height} = params;
    // let vw = params.viewport.width, vh = params.viewport.height;
    //
    // // dimensions must be a multiple of 2
    // if (vw % 2 !== 0) vw -= 1;
    // if (vh % 2 !== 0) vh -= 1;
    //
    // const normalizedViewport: Viewport = {...params.viewport, width: vw, height: vh};
    //
    //
    // encoder.width = vw;
    // encoder.height = vh;
    // if (params.quantizationParameter) encoder.quantizationParameter = params.quantizationParameter;
    // if (params.fps) encoder.frameRate = params.fps;
    // // mp4
    // encoder.initialize();
    //
    // const loop = plugin.animationLoop;
    // const canvasProps = plugin.canvas3d?.props;
    // const wasAnimating = loop.isAnimating;
    // let stoppedAnimation = true, finalized = false;
    //
    // params.pass.setProps({
    //     postprocessing: ParamDefinition.merge(PostprocessingParams, params.pass.props.postprocessing, params.postprocessing),
    // });
    //
    // try {
    //     loop.stop();
    //     loop.resetTime(0);
    //
    //     if (params.customBackground !== void 0) {
    //         plugin.canvas3d?.setProps({
    //             renderer: {backgroundColor: params.customBackground},
    //             transparentBackground: false
    //         }, true);
    //     }
    //
    //     const fps = encoder.frameRate;
    //     const N = Math.ceil(durationMs / 1000 * fps);
    //     const dt = durationMs / N;
    //
    //     await ctx.update({message: 'Rendering...', isIndeterminate: false, current: 0, max: N + 1});
    //     await params.pass.updateBackground();
    //
    //
    //     await plugin.managers.animation.play(params.animation.definition, params.animation.params);
    //     stoppedAnimation = false;
    //     for (let i = 0; i <= N; i++) {
    //         await loop.tick(i * dt, {
    //             isSynchronous: true,
    //             animation: {currentFrame: i, frameCount: N},
    //             manualDraw: true
    //         });
    //         // mp4
    //         const frame = params.pass.getImageData(width, height, normalizedViewport);
    //         encoder.addFrameRgba(frame.data);
    //
    //         if (ctx.shouldUpdate) {
    //             await ctx.update({current: i + 1});
    //         }
    //     }
    //     await ctx.update({message: 'Applying finishing touches...', isIndeterminate: true});
    //     await plugin.managers.animation.stop();
    //     stoppedAnimation = true;
    //
    //     // mp4
    //     encoder.finalize();
    //     finalized = true;
    //     return encoder.FS.readFile(encoder.outputFilename);
    // } finally {
    //     // mp4
    //     if (finalized) encoder.delete();
    //
    //     if (params.customBackground !== void 0) {
    //         plugin.canvas3d?.setProps({
    //             renderer: {backgroundColor: canvasProps?.renderer!.backgroundColor},
    //             transparentBackground: canvasProps?.transparentBackground
    //         });
    //     }
    //     if (!stoppedAnimation) await plugin.managers.animation.stop();
    //     if (wasAnimating) loop.start();
    // }
}

function pad(number: number, length: number) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

export async function encodeWebmAnimation<A extends PluginStateAnimation>(plugin: PluginContext, ctx: RuntimeContext, params: Mp4EncoderParams<A>) {
    return new Promise(async (resolve, reject) => {
        try {

            let outputFilename = '../outputs_1qtn-4/video.webm';

            await ctx.update({message: 'Initializing...', isIndeterminate: true});

            if (!params.fps) params.fps = 30;

            validateViewport(params);
            const durationMs = PluginStateAnimation.getDuration(plugin, params.animation);
            if (durationMs === void 0) {
                throw new Error('The animation does not have the duration specified.');
            }


            const {width, height} = params;
            let vw = params.viewport.width, vh = params.viewport.height;

            // dimensions must be a multiple of 2
            if (vw % 2 !== 0) vw -= 1;
            if (vh % 2 !== 0) vh -= 1;

            const normalizedViewport: Viewport = {...params.viewport, width: vw, height: vh};

            const loop = plugin.animationLoop;

            params.pass.setProps({
                postprocessing: ParamDefinition.merge(PostprocessingParams, params.pass.props.postprocessing, params.postprocessing),
            });

            loop.stop();
            loop.resetTime(0);

            if (params.customBackground !== void 0) {
                plugin.canvas3d?.setProps({
                    renderer: {backgroundColor: params.customBackground},
                    transparentBackground: false
                }, true);
            }

            const fps = params.fps;
            const N = Math.ceil(durationMs / 1000 * fps);
            const dt = durationMs / N;

            await ctx.update({message: 'Rendering...', isIndeterminate: false, current: 0, max: N + 1});
            await params.pass.updateBackground();

            await plugin.managers.animation.play(params.animation.definition, params.animation.params);
            const images = []
            console.time("boucle for")
            for (let i = 0; i <= N; i++) {
                await loop.tick(i * dt, {
                    isSynchronous: true,
                    animation: {currentFrame: i, frameCount: N},
                    manualDraw: true
                });
                const frame = params.pass.getImageData(width, height, normalizedViewport);
                images.push(new Uint8Array(frame.data))

            }
            console.timeEnd("boucle for")
            const stream2 = Readable.from(images);
            console.time("ffmpeg")
            const command = ffmpeg(stream2)
                .videoCodec('libvpx-vp9')
                .addInputOption([`-s ${width}x${height}`,
                    `-pix_fmt rgba`,
                    `-r ${fps}`])
                .inputFormat('rawvideo')
                .output(outputFilename)
                // .outputOptions(['-crf 50'])
                .addOption('-crf', '50')
                // .withVideoBitrate(2048)
                .on('error', (err: any) => {
                    reject(err);
                })
                .on('end', () => {
                    console.log('file has been converted succesfully');
                    console.timeEnd("ffmpeg")
                }).save(outputFilename);

        } catch (e) {
            console.error(e)
        }
    });
}


function validateViewport(params: Mp4EncoderParams) {
    if (params.viewport.x + params.viewport.width > params.width || params.viewport.y + params.viewport.height > params.height) {
        throw new Error('Viewport exceeds the canvas dimensions.');
    }
}