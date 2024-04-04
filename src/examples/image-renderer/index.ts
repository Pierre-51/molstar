/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 *
 * Example command-line application generating images of PDB structures
 * Build: npm install --no-save gl jpeg-js pngjs  // these packages are not listed in dependencies for performance reasons
 *        npm run build
 * Run:   node lib/commonjs/examples/image-renderer 1cbs ../outputs_1cbs/
 */

import {ArgumentParser} from 'argparse';
import fs from 'fs';
import path from 'path';
import gl from 'gl';
import pngjs from 'pngjs';
import jpegjs from 'jpeg-js';

import {Download, ParseCif} from '../../mol-plugin-state/transforms/data';
import {
    ModelFromTrajectory,
    StructureComponent,
    StructureFromModel,
    TrajectoryFromMmCif
} from '../../mol-plugin-state/transforms/model';
import {StructureRepresentation3D} from '../../mol-plugin-state/transforms/representation';
import {HeadlessPluginContext} from '../../mol-plugin/headless-plugin-context';
import {DefaultPluginSpec} from '../../mol-plugin/spec';
import {ExternalModules, STYLIZED_POSTPROCESSING} from '../../mol-plugin/util/headless-screenshot';
import {setFSModule} from '../../mol-util/data-source';
import {FxaaParams} from "../../mol-canvas3d/passes/fxaa";
import {PostprocessingParams} from "../../mol-canvas3d/passes/postprocessing";
import {ParamDefinition as PD} from "../../mol-util/param-definition";
import {Canvas3DParams} from "../../mol-canvas3d/canvas3d";
import {PluginCommands} from "../../mol-plugin/commands";
import {Task} from "../../mol-task";
import {encodeMp4Animation, encodeWebmAnimation} from "../../extensions/mp4-export/encoder";
import canvas from 'canvas';
// import {encodeMp4Animation} from "../../extensions/mp4-export/encoder";

// @ts-ignore
global.ImageData = canvas.ImageData


setFSModule(fs);

interface Args {
    pdbId: string,
    outDirectory: string
}

function parseArguments(): Args {
    const parser = new ArgumentParser({description: 'Example command-line application generating images of PDB structures'});
    parser.add_argument('pdbId', {help: 'PDB identifier'});
    parser.add_argument('outDirectory', {help: 'Directory for outputs'});
    const args = parser.parse_args();
    return {...args};
}


async function exportMovie(plugin: HeadlessPluginContext) {
    const task = Task.create('Export Movie', async ctx => {
        const width = 1280; // Adjust width and height as needed
        const height = 720;
        const anim = plugin.managers.animation.animations.find((a: {
            name: string;
        }) => a.name === 'built-in.animate-camera-spin');
        if (!anim) throw new Error('Animation type not found');

        // console.log(plugin.canvas3d?.camera)
        // const controls = new Mp4Controls(plugin);
        // let render = await controls.render();
        // console.log(render.filename)

        const movie = await encodeWebmAnimation(plugin, ctx, {
            animation: {
                definition: anim,
                params: {
                    direction: 'cw',
                    durationInMs: 5000,
                    speed: 1,
                },
            },
            // ...resolution,
            postprocessing: {
                ...PD.getDefaultValues(PostprocessingParams),
                ...STYLIZED_POSTPROCESSING,
                antialiasing: {
                    name: 'fxaa',
                    params: PD.getDefaultValues(FxaaParams),
                },

            },
            width: width,
            height: height,
            viewport: {x: 0, y: 0, width, height},
            quantizationParameter: 18, // this.behaviors.params.value.quantization,
            pass: plugin.renderer.imagePass,
        });
        return {movie, filename: `video.webm`};

    });

    return await plugin.runTask(task);
}

async function main() {
    console.time("Video Processing");
    const args = parseArguments();
    const url = `https://www.ebi.ac.uk/pdbe/entry-files/download/${args.pdbId}.bcif`;
    console.log('PDB ID:', args.pdbId);
    console.log('Source URL:', url);
    console.log('Outputs:', args.outDirectory);

    // Create a headless plugin
    const externalModules: ExternalModules = {gl, pngjs, 'jpeg-js': jpegjs};
    const plugin = new HeadlessPluginContext(externalModules, DefaultPluginSpec(), {width: 800, height: 800},
        {
            webgl: {
                alpha: true, // Set to true if you need alpha
                antialias: true, // Set to true if you need antialiasing
                premultipliedAlpha: true, // Set to true if you need premultiplied alpha
                stencil: false, // Set to true if you need stencil buffer
                depth: true, // Set to true if you need depth buffer
                preserveDrawingBuffer: true, // Set to true if you need to preserve drawing buffer
                // @ts-ignore
                preferLowPowerToHighPerformance: false, // Set to true if you prefer low power to high performance
                failIfMajorPerformanceCaveat: false, // Set to true if you want context creation to fail if the performance of a WebGL context would be dramatically lower than that of a native application

            },
            canvas: {
                cameraFog: {name: 'off', params: {}},
                camera: {...PD.getDefaultValues(Canvas3DParams).camera, mode: 'perspective'},
                postprocessing: {
                    ...PD.getDefaultValues(PostprocessingParams),
                    ...STYLIZED_POSTPROCESSING,
                    antialiasing: {
                        name: 'fxaa',
                        params: PD.getDefaultValues(FxaaParams),
                    },

                }
            }
        }
    );
    await plugin.init();


    plugin.renderer.imagePass.setProps({transparentBackground: true});
    await plugin.renderer.imagePass.updateBackground();


    // Download and visualize data in the plugin
    const update = plugin.build();
    const structure = update.toRoot()
        .apply(Download, {url, isBinary: true})
        .apply(ParseCif)
        .apply(TrajectoryFromMmCif)
        .apply(ModelFromTrajectory)
        .apply(StructureFromModel)

    const polymer = structure.apply(StructureComponent, {type: {name: 'static', params: 'polymer'}});
    const ligand = structure.apply(StructureComponent, {type: {name: 'static', params: 'ligand'}});
    polymer.apply(StructureRepresentation3D, {
        type: {name: 'cartoon', params: {alpha: 1, ignoreLight: true}},
        colorTheme: {name: 'sequence-id', params: {}},
    });
    ligand.apply(StructureRepresentation3D, {
        type: {name: 'ball-and-stick', params: {sizeFactor: 0.15}},
        sizeTheme: {name: 'physical', params: {}},
    });

    await update.commit();

    plugin.canvas3d?.commit(true);
    await PluginCommands.Camera.OrientAxes(plugin, {durationMs: 0});

    // Export images
    fs.mkdirSync(args.outDirectory, {recursive: true});

    await exportMovie(plugin);
    // console.log(movie)
    // const movie = new ArrayBuffer(mov.movie)
    // fs.writeFileSync(path.join(args.outDirectory, 'videoo.webm'), Buffer.from(new Uint8Array(movie.movie)))
    // fs.writeFileSync(path.join(args.outDirectory, 'videoo.webm'), movie.movie)


    // console.log(movie)

    // await plugin.saveImage(path.join(args.outDirectory, 'stylized.png'), undefined, STYLIZED_POSTPROCESSING);

    // Export state loadable in Mol* Viewer
    // await plugin.saveStateSnapshot(path.join(args.outDirectory, 'molstar-state.molj'));

    console.timeEnd("Video Processing");
    // Cleanup
    await plugin.clear();
    plugin.dispose();

}

main();
