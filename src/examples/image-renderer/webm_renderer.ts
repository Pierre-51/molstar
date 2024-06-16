/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 * @author Pierre Sinquin <psinauin@ebi.ac.uk>
 *
 * Adaptation of an Example command-line application generating Webm Video of structures
 * Build: npm install --no-save gl jpeg-js pngjs  // these packages are not listed in dependencies for performance reasons
 *        npm run build
 * Run:   node lib/commonjs/examples/webm-renderer.js path/to/your/directory ../outputs/
 */

import {ArgumentParser} from 'argparse';
import fs from 'fs';
import path from 'path';
import {promisify} from 'util';
import gl from 'gl';
import pngjs from 'pngjs';
import jpegjs from 'jpeg-js';

import {Download, ParseCif} from '../../mol-plugin-state/transforms/data';
import {
    ModelFromTrajectory,
    StructureComponent,
    StructureFromModel,
    TrajectoryFromMmCif,
    TrajectoryFromPDB
} from '../../mol-plugin-state/transforms/model';
import {StructureRepresentation3D} from '../../mol-plugin-state/transforms/representation';
import {HeadlessPluginContext} from '../../mol-plugin/headless-plugin-context';
import {DefaultPluginSpec, PluginSpec} from '../../mol-plugin/spec';
import {ExternalModules, STYLIZED_POSTPROCESSING} from '../../mol-plugin/util/headless-screenshot';
import {setFSModule} from '../../mol-util/data-source';
import {FxaaParams} from "../../mol-canvas3d/passes/fxaa";
import {PostprocessingParams} from "../../mol-canvas3d/passes/postprocessing";
import {ParamDefinition as PD} from "../../mol-util/param-definition";
import {Canvas3DParams} from "../../mol-canvas3d/canvas3d";
import {PluginCommands} from "../../mol-plugin/commands";
import {Task} from "../../mol-task";
import {encodeWebmAnimation} from "../../extensions/mp4-export/encoder";
import canvas from 'canvas';
import {Color} from '../../mol-util/color';
import {MAQualityAssessment} from "../../extensions/model-archive/quality-assessment/behavior";
import {QualityAssessment} from "../../extensions/model-archive/quality-assessment/prop";

// @ts-ignore
global.ImageData = canvas.ImageData

setFSModule(fs);

interface Args {
    input: string,
    outDirectory: string
}

function parseArguments(): Args {
    const parser = new ArgumentParser({description: 'Example command-line application generating images of PDB structures'});
    parser.add_argument('input', {help: 'Containing .cif or .pdb files'});
    parser.add_argument('outDirectory', {help: 'Directory for outputs'});
    const args = parser.parse_args();
    return {...args};
}

async function exportMovie(plugin: HeadlessPluginContext, filename: string) {
    const task = Task.create('Export Movie', async ctx => {
        const width = 1280; // Adjust width and height as needed
        const height = 720;
        // const width = 853; // Adjust width and height as needed
        // const height = 480;
        const anim = plugin.managers.animation.animations.find((a: {
            name: string;
        }) => a.name === 'built-in.animate-camera-spin');
        if (!anim) throw new Error('Animation type not found');

        await encodeWebmAnimation(plugin, ctx, {
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
                quantizationParameter: 18,
                pass: plugin.renderer.imagePass,
            }, filename
        );

    });

    await plugin.runTask(task);
}

async function processFilesInDirectory(input: string, outDirectory: string) {
    if (fs.lstatSync(input).isDirectory()) {
        const files = await promisify(fs.readdir)(input);
        const structureFile = files.filter(file => file.endsWith('.cif') || file.endsWith('.pdb'));
        // console.log('Files input:', structureFile);
        for (const file of structureFile) {

            if (file.endsWith('.pdb')) {
                // console.log('Starting to process:', file)
                await processFile(path.join(input, file), outDirectory, 'pdb');
            } else {
                // console.log('Starting to process:', file)
                await processFile(path.join(input, file), outDirectory, 'cif');
            }
        }
    } else {
        // console.log('File input:', path.parse(input).base);
        if (input.endsWith('.pdb')) {
            await processFile(input, outDirectory, 'pdb');
        } else {
            await processFile(input, outDirectory, 'cif');
        }
    }
}

async function processFile(filePath: string, outDirectory: string, fileType: 'pdb' | 'cif') {
    const url = `file://${filePath}`;
    const externalModules: ExternalModules = {gl, pngjs, 'jpeg-js': jpegjs};
    const plugin = new HeadlessPluginContext(externalModules, {
            ...DefaultPluginSpec(),
            behaviors: [PluginSpec.Behavior(MAQualityAssessment, {autoAttach: true}), ...DefaultPluginSpec().behaviors]
        }, {width: 800, height: 800},
        {
            webgl: {
                alpha: true,
                antialias: true,
                premultipliedAlpha: true,
                stencil: false,
                depth: true,
                preserveDrawingBuffer: true,
                // @ts-ignore
                preferLowPowerToHighPerformance: false,
                failIfMajorPerformanceCaveat: false,
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
    const update = plugin.build();
    plugin.renderer.imagePass.setProps({transparentBackground: true});
    await plugin.renderer.imagePass.updateBackground();


    let trajectory;
    if (fileType === 'cif') {
        trajectory = update.toRoot()
            .apply(Download, {url})
            .apply(ParseCif)
            .apply(TrajectoryFromMmCif)
    } else if (fileType === 'pdb') {
        trajectory = update.toRoot()
            .apply(Download, {url})
            .apply(TrajectoryFromPDB);
    } else return;

    const structure = trajectory
        .apply(ModelFromTrajectory)
        .apply(StructureFromModel, {type: {name: 'assembly', params: {}}});

    structure
        .apply(StructureComponent, {type: {name: 'static', params: 'ligand'}})
        .apply(StructureRepresentation3D, {
            type: {name: 'ball-and-stick', params: {sizeFactor: 0.15}},
            sizeTheme: {name: 'physical', params: {}},
        });

    let polymer = await structure
        .apply(StructureComponent, {type: {name: 'static', params: 'polymer'}})
        .commit();

    if (!polymer.data) throw new Error('polymer data is missing');
    const isAlphaFold = polymer.data.models.some(model => QualityAssessment.isApplicable(model, "pLDDT"));

    const colorTheme = isAlphaFold ?
        {name: 'plddt-confidence', params: {}} :
        {name: 'uniform', params: {value: Color(0x888888)}};

    await plugin.build()
        .to(polymer)
        .apply(StructureRepresentation3D, {
            type: {name: 'cartoon', params: {alpha: 1, ignoreLight: true,}},
            colorTheme,
        }).commit();


    plugin.canvas3d?.commit(true);

    await PluginCommands.Camera.OrientAxes(plugin, {durationMs: 0});
    plugin.canvas3d?.commit(true);


    fs.mkdirSync(outDirectory, {recursive: true});
    const outputFilePath = outDirectory + path.basename(url, path.extname(url))
    await exportMovie(plugin, outputFilePath);
    await plugin.clear();
    plugin.dispose();
}

async function main() {
    const args = parseArguments();
    // console.log('Outputs:', args.outDirectory);
    await processFilesInDirectory(args.input, args.outDirectory);
}

main();
